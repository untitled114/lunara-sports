import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import {
  fetchTeamDetail,
  fetchTeamRoster,
  fetchTeamSchedule,
  fetchStandings,
  buildStandingsLookup,
} from '@/services/api';
import { getHeadshotUrl, getLogoUrl } from '@/utils/teamColors';
import { useTheme } from '@/context/ThemeContext';
import { recordLine, seedBadge } from '@/lib/gameMath';
import { Badge, Card, DataTable, PageState, SectionHeader, Segmented, Stat, TeamMark } from '@/components/ui';

const TABS = [
  { id: 'roster', label: 'Roster' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'stats', label: 'Stats' },
];

// Conference position for every team, not just the top 10 that seedBadge()
// badges. ESPN's playoffSeed (`seed`) is conference-relative 1..15 and
// present for the whole conference during the season; the computed standings
// sort `rank` (also conference-relative, from buildStandingsLookup) is the
// fallback for the rare case it isn't (e.g. very early season).
function confRank(standingsTeam) {
  if (!standingsTeam) return null;
  const n = standingsTeam.seed ?? standingsTeam.rank;
  if (!n) return null;
  return standingsTeam.conf ? `#${n} ${standingsTeam.conf}` : `#${n}`;
}

// "0"/"-" games back means this team leads its conference — say so in plain
// copy instead of showing a bare dash or zero.
function gbLabel(gb) {
  return gb === '-' || gb === '0' ? 'Leader' : gb;
}

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
            <Link to={`/player/${p.id}`} className="flex items-center gap-2 text-text-1 hover:text-accent">
              {p.headshot_url ? (
                <img
                  src={getHeadshotUrl(p.headshot_url, 64)}
                  alt=""
                  loading="lazy"
                  className="h-8 w-8 shrink-0 rounded-lg border border-border object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 t-label text-text-3">
                  {p.name?.[0] || '?'}
                </span>
              )}
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
// Built from the standings row the page already loads for this team (D12) —
// there is no per-player stats source (team_service.get_team_stats() has none,
// owner-approved), so this is the team's season standings, not box-score stats.

function StatsTab({ standingsTeam, seasonLabel, isPrevSeason, seed }) {
  if (!standingsTeam) {
    return <PageState kind="empty" title="Stats aren't available for this team yet." />;
  }

  const fields = [
    { label: 'Rank', value: confRank(standingsTeam) },
    { label: 'W', value: standingsTeam.w },
    { label: 'L', value: standingsTeam.l },
    { label: 'PCT', value: standingsTeam.pct },
    { label: 'GB', value: gbLabel(standingsTeam.gb) },
    { label: 'Home', value: standingsTeam.home },
    { label: 'Road', value: standingsTeam.road },
    { label: 'L10', value: standingsTeam.l10 },
  ];
  if (!isPrevSeason) fields.push({ label: 'Streak', value: standingsTeam.streak });

  return (
    <div className="space-y-4">
      <SectionHeader title="Season stats" aside={seasonLabel} />
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {fields.map((f) => (
            <Stat key={f.label} label={f.label} value={f.value || '—'} />
          ))}
        </div>
      </Card>
      {seed && (
        <div className="flex items-center gap-2">
          <span className="t-label text-text-3">Seed</span>
          <Badge variant={seed.variant}>{seed.text}</Badge>
        </div>
      )}
    </div>
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
  const [rosterLoading, setRosterLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Load team detail + standings (record, seed, and — D12 — the Stats tab's
  // W/L/PCT/GB/Home/Road/L10/Streak, all from the standings row for this team)
  const loadTeam = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRoster([]);
    setSchedule([]);

    Promise.all([fetchTeamDetail(abbrev), fetchStandings().catch(() => null)])
      .then(([teamData, standingsData]) => {
        if (cancelled) return;
        setTeam(teamData);

        const lookup = buildStandingsLookup(standingsData);
        const entry = lookup[abbrev] || null;
        if (entry) {
          // buildStandingsLookup doesn't carry seed/home/road — pull them from
          // the raw standings rows it was built from and merge them in.
          const rawTeams = [...(standingsData?.eastern || []), ...(standingsData?.western || [])];
          const raw = rawTeams.find((t) => t.abbrev === abbrev);
          entry.seed = raw?.seed ?? null;
          entry.home = raw?.home ?? '';
          entry.road = raw?.road ?? '';
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
    }
    // The Stats tab needs no fetch of its own — it's derived from standings
    // data loaded by loadTeam() above.
    // roster/schedule are read only to gate a one-time fetch per tab, not to
    // retrigger it once loaded.
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
  const rank = confRank(standingsTeam);

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

          {(record || rank) && (
            <div className="flex flex-wrap items-center gap-6">
              {record && <Stat label="Record" value={record} />}
              {rank && <Stat label="Conference rank" value={rank} />}
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Segmented options={TABS} value={activeTab} onChange={handleTabChange} />
        <p className="t-small text-text-2">Roster size: {roster.length || '—'}</p>
      </div>

      <div key={activeTab}>
        {activeTab === 'roster' && <RosterTab roster={roster} loading={rosterLoading} />}
        {activeTab === 'schedule' && <ScheduleTab schedule={schedule} loading={scheduleLoading} />}
        {activeTab === 'stats' && (
          <StatsTab standingsTeam={standingsTeam} seasonLabel={seasonLabel} isPrevSeason={isPrevSeason} seed={seed} />
        )}
      </div>
    </div>
  );
}
