import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import {
  fetchTeamDetail,
  fetchTeamRoster,
  fetchTeamSchedule,
  fetchTeamStats,
  fetchStandings,
  buildStandingsLookup,
} from '@/services/api';
import { getLogoUrl } from '@/utils/teamColors';
import { useTheme } from '@/context/ThemeContext';
import { recordLine, seedBadge } from '@/lib/gameMath';
import { Badge, Card, DataTable, PageState, SectionHeader, Segmented, Stat, TeamMark } from '@/components/ui';

const TABS = [
  { id: 'roster', label: 'Roster' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'stats', label: 'Stats' },
];

// ─── Roster tab ─────────────────────────────────────────────

function RosterTab({ roster, loading }) {
  if (loading) return <PageState kind="loading" />;
  if (roster.length === 0) return <PageState kind="empty" title="No roster listed yet." />;

  return (
    <DataTable
      getKey={(p) => p.id || `${p.jersey}-${p.name}`}
      columns={[
        { key: 'jersey', label: 'No', numeric: true, render: (p) => (p.jersey ? `#${p.jersey}` : '—') },
        {
          key: 'name',
          label: 'Player',
          render: (p) => (
            <Link to={`/player/${p.id}`} className="text-text-1 hover:text-accent">
              {p.name}
            </Link>
          ),
        },
        { key: 'position', label: 'Pos' },
        { key: 'height', label: 'Ht' },
        { key: 'weight', label: 'Wt', numeric: true, render: (p) => (p.weight ? `${p.weight} lbs` : '—') },
        { key: 'age', label: 'Age', numeric: true, render: (p) => p.age || '—' },
        { key: 'experience', label: 'Exp', render: (p) => p.experience || 'R' },
      ]}
      rows={roster}
    />
  );
}

// ─── Schedule tab ───────────────────────────────────────────

function ScheduleTab({ schedule, loading }) {
  if (loading) return <PageState kind="loading" />;
  if (schedule.length === 0) return <PageState kind="empty" title="No games scheduled yet." />;

  const upcoming = schedule.filter((g) => g.status !== 'Final').slice(0, 15);
  const results = schedule.filter((g) => g.status === 'Final').slice(0, 20);

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <SectionHeader title="Upcoming" />
          <DataTable
            getKey={(g) => g.game_id}
            columns={[
              { key: 'date', label: 'Date' },
              {
                key: 'opponent',
                label: 'Opponent',
                render: (g) => (
                  <Link to={`/game/${g.game_id}`} className="text-text-1 hover:text-accent">
                    {g.opponent}
                  </Link>
                ),
              },
              { key: 'status', label: 'Status' },
            ]}
            rows={upcoming}
          />
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <SectionHeader title="Recent results" />
          <DataTable
            getKey={(g) => g.game_id}
            columns={[
              { key: 'date', label: 'Date' },
              {
                key: 'opponent',
                label: 'Opponent',
                render: (g) => (
                  <Link to={`/game/${g.game_id}`} className="text-text-1 hover:text-accent">
                    {g.opponent}
                  </Link>
                ),
              },
              {
                key: 'result',
                label: 'Result',
                render: (g) => (
                  <Badge variant={g.result?.startsWith('W') ? 'win' : g.result?.startsWith('L') ? 'loss' : 'neutral'}>
                    {g.result || '—'}
                  </Badge>
                ),
              },
              { key: 'score', label: 'Score', numeric: true },
            ]}
            rows={results}
          />
        </div>
      )}
    </div>
  );
}

// ─── Stats tab ──────────────────────────────────────────────

function StatsTab({ stats, loading }) {
  if (loading) return <PageState kind="loading" />;
  if (stats.length === 0) return <PageState kind="empty" title="No stats available yet." />;

  return (
    <DataTable
      getKey={(s) => s.player}
      columns={[
        { key: 'player', label: 'Player' },
        { key: 'gp', label: 'GP', numeric: true },
        { key: 'mpg', label: 'MPG', numeric: true },
        { key: 'ppg', label: 'PPG', numeric: true },
        { key: 'rpg', label: 'RPG', numeric: true },
        { key: 'apg', label: 'APG', numeric: true },
        { key: 'spg', label: 'SPG', numeric: true },
        { key: 'bpg', label: 'BPG', numeric: true },
        { key: 'fg_pct', label: 'FG%', numeric: true },
        { key: 'three_pct', label: '3P%', numeric: true },
      ]}
      rows={stats}
    />
  );
}

// ─── Main page ──────────────────────────────────────────────

export default function TeamDetailPage() {
  const { abbrev } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'roster';
  const { playGlassClick } = useTheme();

  const [team, setTeam] = useState(null);
  const [standingsTeam, setStandingsTeam] = useState(null);
  const [seasonLabel, setSeasonLabel] = useState('');
  const [isPrevSeason, setIsPrevSeason] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [roster, setRoster] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [stats, setStats] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  // Load team detail + standings (record, seed)
  const loadTeam = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRoster([]);
    setSchedule([]);
    setStats([]);

    Promise.all([fetchTeamDetail(abbrev), fetchStandings().catch(() => null)])
      .then(([teamData, standingsData]) => {
        if (cancelled) return;
        setTeam(teamData);

        const lookup = buildStandingsLookup(standingsData);
        const entry = lookup[abbrev] || null;
        if (entry) {
          // buildStandingsLookup doesn't carry the seed — pull it from the raw
          // standings rows it was built from and merge it in.
          const rawTeams = [...(standingsData?.eastern || []), ...(standingsData?.western || [])];
          const raw = rawTeams.find((t) => t.abbrev === abbrev);
          entry.seed = raw?.seed ?? null;
        }
        setStandingsTeam(entry);
        setSeasonLabel(standingsData?.season_label || '');
        setIsPrevSeason(!!standingsData?.is_previous_season);
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
  }, [abbrev]);

  useEffect(() => loadTeam(), [loadTeam]);

  // Lazy-load the active tab's data once
  useEffect(() => {
    if (!team) return;
    if (activeTab === 'roster' && roster.length === 0) {
      setRosterLoading(true);
      fetchTeamRoster(abbrev)
        .then(setRoster)
        .catch(() => {})
        .finally(() => setRosterLoading(false));
    } else if (activeTab === 'schedule' && schedule.length === 0) {
      setScheduleLoading(true);
      fetchTeamSchedule(abbrev)
        .then(setSchedule)
        .catch(() => {})
        .finally(() => setScheduleLoading(false));
    } else if (activeTab === 'stats' && stats.length === 0) {
      setStatsLoading(true);
      fetchTeamStats(abbrev)
        .then(setStats)
        .catch(() => {})
        .finally(() => setStatsLoading(false));
    }
    // roster/schedule/stats are read only to gate a one-time fetch per tab, not
    // to retrigger it once loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, abbrev, team]);

  const handleTabChange = (id) => {
    playGlassClick();
    setSearchParams({ tab: id });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PageState kind="loading" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PageState kind="error" title="Couldn't load this team." onRetry={loadTeam} />
      </div>
    );
  }

  const logoUrl = getLogoUrl(abbrev);
  const record = recordLine(standingsTeam, seasonLabel, isPrevSeason);
  const seed = standingsTeam ? seedBadge(standingsTeam, isPrevSeason) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link
        to="/teams"
        onClick={() => playGlassClick()}
        className="inline-flex items-center gap-1 t-small text-text-2 hover:text-text-1"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        All teams
      </Link>

      <Card className="flex flex-col sm:flex-row sm:items-center gap-6">
        <TeamMark abbrev={abbrev} logoUrl={logoUrl} size="lg" />

        <div className="flex-1 min-w-0 space-y-3">
          <h1 className="t-title text-text-1">{team.name}</h1>

          {(team.city || team.venue) && (
            <div className="flex flex-wrap items-center gap-3 t-small text-text-2">
              {team.city && <span>{team.city}</span>}
              {team.venue && <span>{team.venue}</span>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {team.conference && <Badge>{team.conference}</Badge>}
            {team.division && <Badge>{team.division}</Badge>}
            {seed && <Badge variant={seed.variant}>{seed.text}</Badge>}
          </div>

          {record && <Stat label="Record" value={record} />}
        </div>
      </Card>

      <Segmented options={TABS} value={activeTab} onChange={handleTabChange} />

      <div key={activeTab}>
        {activeTab === 'roster' && <RosterTab roster={roster} loading={rosterLoading} />}
        {activeTab === 'schedule' && <ScheduleTab schedule={schedule} loading={scheduleLoading} />}
        {activeTab === 'stats' && <StatsTab stats={stats} loading={statsLoading} />}
      </div>
    </div>
  );
}
