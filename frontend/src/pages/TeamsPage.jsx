import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { fetchTeams } from '@/services/api';
import { useTheme } from '@/context/ThemeContext';
import { getLogoUrl } from '@/utils/teamColors';
import { Badge, Card, PageState, SectionHeader, Segmented, TeamMark } from '@/components/ui';

const CONF_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'east', label: 'Eastern' },
  { id: 'west', label: 'Western' },
];

function TeamRow({ team }) {
  const { playGlassClick } = useTheme();
  const logoUrl = getLogoUrl(team.abbrev);
  const lastGame = team.last_game || '';
  const result = lastGame ? lastGame.split(' ')[0] : '';
  const detail = lastGame ? lastGame.split(' ').slice(1).join(' ') : '';
  const isWin = result === 'W';
  const isLoss = result === 'L';

  return (
    <Link
      to={`/team/${team.abbrev}`}
      onClick={() => playGlassClick()}
      className="flex items-center justify-between gap-4 py-3 -mx-2 px-2 rounded-md hover:bg-surface-2 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <TeamMark abbrev={team.abbrev} logoUrl={logoUrl} size="sm" />
        <span className="t-small text-text-2 truncate">{team.name}</span>
      </div>

      {lastGame ? (
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={isWin ? 'win' : isLoss ? 'loss' : 'neutral'}>{result}</Badge>
          <span className="t-small tnum text-text-2">{detail}</span>
        </div>
      ) : (
        <span className="t-small text-text-3 shrink-0">
          {team.conference} · {team.division}
        </span>
      )}

      <ChevronRight className="h-4 w-4 text-text-3 shrink-0" />
    </Link>
  );
}

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeConf, setActiveConf] = useState('all');
  const { playGlassClick } = useTheme();

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTeams()
      .then((data) => {
        if (!cancelled) setTeams(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  const handleConfChange = (conf) => {
    if (activeConf !== conf) {
      playGlassClick();
      setActiveConf(conf);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <PageState kind="loading" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <PageState kind="error" title="Couldn't load teams." onRetry={load} />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <PageState kind="empty" title="No teams found." />
      </div>
    );
  }

  // Group into conference -> division -> teams
  const grouped = {};
  for (const team of teams) {
    const conf = team.conference || 'Unknown';
    const div = team.division || 'Unknown';

    if (activeConf === 'east' && !conf.includes('East')) continue;
    if (activeConf === 'west' && !conf.includes('West')) continue;

    grouped[conf] ??= {};
    grouped[conf][div] ??= [];
    grouped[conf][div].push(team);
  }

  const conferences = Object.entries(grouped).map(([conf, divisions]) => ({
    name: conf.includes('East') ? 'Eastern Conference' : conf.includes('West') ? 'Western Conference' : conf,
    divisions: Object.entries(divisions).map(([div, divTeams]) => ({ name: div, teams: divTeams })),
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="t-title text-text-1">Teams</h1>
          <p className="t-small text-text-2 mt-1">All 30 NBA teams.</p>
        </div>
        <Segmented aria-label="Conference" options={CONF_OPTIONS} value={activeConf} onChange={handleConfChange} />
      </div>

      <div className={`grid grid-cols-1 gap-8 ${activeConf === 'all' ? 'lg:grid-cols-2' : ''}`}>
        {conferences.map((conf) => (
          <div key={conf.name} className="space-y-6">
            <SectionHeader title={conf.name} />
            <div className="space-y-6">
              {conf.divisions.map((div) => (
                <div key={div.name} className="space-y-2">
                  <p className="t-label text-text-3">{div.name}</p>
                  <Card className="divide-y divide-border">
                    {div.teams.map((team) => (
                      <TeamRow key={team.abbrev} team={team} />
                    ))}
                  </Card>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
