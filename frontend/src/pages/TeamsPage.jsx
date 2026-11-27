import { useCallback, useEffect, useState } from 'react';
import { fetchStandings, fetchTeams, buildStandingsLookup } from '@/services/api';
import { getLogoUrl } from '@/utils/teamColors';
import { Card, PageState, SectionHeader, Segmented } from '@/components/ui';
import { TeamLink } from '@/components/sport/TeamLink';
import { usePageMeta } from '@/hooks/usePageMeta';

const CONF_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'east', label: 'Eastern' },
  { id: 'west', label: 'Western' },
];

// Three division boxes across, East on top and West below.
const CONFERENCES = [
  { key: 'Eastern', title: 'Eastern Conference', divisions: ['Atlantic', 'Central', 'Southeast'] },
  { key: 'Western', title: 'Western Conference', divisions: ['Northwest', 'Pacific', 'Southwest'] },
];

// One roomy row per team, the whole row one link: logo, full name, then this season's
// record and the last game.
function TeamRow({ team, record }) {
  const lastGame = team.last_game || '';
  const result = lastGame.split(' ')[0];
  const detail = lastGame.split(' ').slice(1).join(' ');

  return (
    <TeamLink
      abbrev={team.abbrev}
      className="flex items-center gap-3 px-4 py-3 border-t border-border hover:bg-surface-2 transition-colors"
    >
      <img src={getLogoUrl(team.abbrev)} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 shrink-0 object-contain" />
      <div className="min-w-0">
        <div className="t-body font-semibold text-text-1 truncate">{team.name}</div>
        <div className="t-small text-text-2 tnum truncate">
          {record && <span className="text-text-1">{record}</span>}
          {record && lastGame && <span aria-hidden="true">{'  ·  '}</span>}
          {lastGame && (
            <>
              <span className={result === 'W' ? 'text-live' : result === 'L' ? 'text-loss' : undefined}>{result}</span> {detail}
            </>
          )}
        </div>
      </div>
    </TeamLink>
  );
}

export default function TeamsPage() {
  usePageMeta('Teams', 'Roster, schedule and numbers for all 30 NBA teams.');
  const [teams, setTeams] = useState([]);
  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeConf, setActiveConf] = useState('all');

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
    // This season's records (none while the standings are still last season's).
    fetchStandings()
      .then((data) => {
        if (!cancelled) setRecords(data && !data.is_previous_season ? buildStandingsLookup(data) : {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  if (loading) return <PageState kind="loading" />;
  if (error) return <PageState kind="error" title="Couldn't load teams." onRetry={load} />;
  if (teams.length === 0) return <PageState kind="empty" title="No teams found." />;

  const shown = CONFERENCES.filter(
    (c) => activeConf === 'all' || (activeConf === 'east' ? c.key === 'Eastern' : c.key === 'Western')
  );
  const inDivision = (conf, div) =>
    teams
      .filter((t) => (t.conference || '').startsWith(conf) && t.division === div)
      .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="t-title text-text-1">Teams</h1>
          <p className="t-small text-text-2 mt-1">All 30 NBA teams.</p>
        </div>
        <Segmented aria-label="Conference" options={CONF_OPTIONS} value={activeConf} onChange={setActiveConf} />
      </div>

      {shown.map((conf) => (
        <section key={conf.key} data-testid={`conference-${conf.key}`} className="space-y-3">
          <SectionHeader title={conf.title} />
          <div data-testid="division-grid" className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {conf.divisions.map((div) => (
              <Card key={div} className="p-0 overflow-hidden">
                <h3 className="t-small font-semibold text-text-2 px-4 py-2.5">{div}</h3>
                {inDivision(conf.key, div).map((team) => (
                  <TeamRow key={team.abbrev} team={team} record={records[team.abbrev]?.record} />
                ))}
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
