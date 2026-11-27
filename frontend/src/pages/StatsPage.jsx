import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Card, DataTable, PageState, Segmented, Skeleton } from '@/components/ui';
import { fetchCategoryLeaders, fetchStatLeaders, fetchTeams, fetchTeamStatsList } from '@/services/api';
import { getHeadshotUrl, getLogoUrl } from '@/utils/teamColors';
import { PlayerLink } from '@/components/sport/PlayerLink';
import { TeamLink } from '@/components/sport/TeamLink';
import { usePageMeta } from '@/hooks/usePageMeta';

// A row of nine leader tiles; the chosen category's top 10 below, with filters.
const CATEGORIES = [
  { id: 'pts', tile: 'Points', title: 'Points per game', unit: 'PTS' },
  { id: 'reb', tile: 'Rebounds', title: 'Rebounds per game', unit: 'REB' },
  { id: 'ast', tile: 'Assists', title: 'Assists per game', unit: 'AST' },
  { id: 'threes', tile: 'Threes', title: 'Threes made per game', unit: '3PM' },
  { id: 'stl', tile: 'Steals', title: 'Steals per game', unit: 'STL' },
  { id: 'blk', tile: 'Blocks', title: 'Blocks per game', unit: 'BLK' },
  { id: 'fg_pct', tile: 'FG%', title: 'Field goal percentage', unit: 'FG%' },
  { id: 'three_pct', tile: '3P%', title: 'Three-point percentage', unit: '3P%' },
  { id: 'ft_pct', tile: 'FT%', title: 'Free throw percentage', unit: 'FT%' },
];

const POSITIONS = [
  { id: '', label: 'All' },
  { id: 'G', label: 'G' },
  { id: 'F', label: 'F' },
  { id: 'C', label: 'C' },
];

const CONFERENCES = [
  { id: '', label: 'League' },
  { id: 'east', label: 'East' },
  { id: 'west', label: 'West' },
];

function LeaderTile({ category, leader, selected, onSelect }) {
  return (
    <button
      type="button"
      data-testid="leader-tile"
      aria-pressed={selected}
      onClick={onSelect}
      className={clsx(
        'flex flex-col items-start gap-1 rounded-lg border bg-surface-1 shadow-card p-2.5 text-left min-w-0 transition-colors',
        selected ? 'border-accent' : 'border-border hover:border-border-strong'
      )}
    >
      <span data-testid="tile-label" className={clsx('t-label font-semibold', selected ? 'text-accent' : 'text-text-2')}>
        {category.tile}
      </span>
      <span className="flex items-center gap-2 min-w-0 w-full">
        {leader?.headshot_url && (
          <img
            src={getHeadshotUrl(leader.headshot_url, 64)}
            alt=""
            width={32}
            height={32}
            loading="lazy"
            className="h-8 w-8 shrink-0 rounded-md bg-surface-2 object-cover object-top"
          />
        )}
        <span className="t-score-sm tnum text-text-1">{leader?.value ?? '-'}</span>
      </span>
      <span className="t-label text-text-2 truncate w-full" title={leader?.player}>{leader?.player ?? ''}</span>
    </button>
  );
}

// The chosen category's top 10 after the filters, each row one link to the player, with a
// bar against the list's leader.
function CategoryTable({ category, data }) {
  const top = parseFloat(data.rows[0]?.value) || 0;
  const columns = [
    { key: 'rank', label: '#', numeric: true },
    {
      key: 'player',
      label: 'Player',
      render: (r) => (
        <PlayerLink id={r.player_id} className="flex items-center gap-2.5 min-w-0 text-text-1 hover:text-accent">
          <img
            src={getHeadshotUrl(r.headshot_url, 64)}
            alt=""
            width={32}
            height={32}
            loading="lazy"
            className="h-8 w-8 shrink-0 rounded-md bg-surface-2 object-cover object-top"
          />
          {/* Phones: cut short so the value column stays in view. */}
          <span className="truncate max-w-[110px] sm:max-w-none font-semibold" title={r.player}>{r.player}</span>
        </PlayerLink>
      ),
    },
    { key: 'team', label: 'Team', nowrap: true },
    { key: 'gp', label: 'GP', numeric: true, render: (r) => r.gp ?? '-' },
    {
      key: 'value',
      label: category.unit,
      numeric: true,
      render: (r) => (
        <span className="inline-flex items-center justify-end gap-3">
          <span className="hidden sm:block w-28 h-1.5 rounded-sm bg-surface-2 overflow-hidden" aria-hidden="true">
            <span
              data-testid="leader-bar"
              className="block h-full bg-accent"
              style={{ width: `${top ? ((parseFloat(r.value) / top) * 100).toFixed(1) : 0}%` }}
            />
          </span>
          <span className="tnum font-semibold text-text-1">{r.value}</span>
        </span>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={data.rows}
      getKey={(r) => r.player_id}
      rowLink={(r) => (r.player_id ? `/player/${r.player_id}` : null)}
    />
  );
}

function PlayersView({ leaders, teams }) {
  const [params, setParams] = useSearchParams();
  const catId = CATEGORIES.some((c) => c.id === params.get('cat')) ? params.get('cat') : 'pts';
  const category = CATEGORIES.find((c) => c.id === catId);
  const filters = useMemo(() => {
    const f = {};
    if (params.get('team')) f.team = params.get('team');
    if (params.get('pos')) f.position = params.get('pos');
    if (params.get('conf')) f.conference = params.get('conf');
    return f;
  }, [params]);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    fetchCategoryLeaders(catId, filters)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [catId, filters, nonce]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
        {CATEGORIES.map((c) => (
          <LeaderTile key={c.id} category={c} leader={leaders[c.id]?.[0]} selected={c.id === catId} onSelect={() => set('cat', c.id === 'pts' ? '' : c.id)} />
        ))}
      </div>

      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <h2 className="t-section text-text-1">{category.title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Team"
              value={filters.team || ''}
              onChange={(e) => set('team', e.target.value)}
              className="min-h-[44px] sm:min-h-[36px] rounded-md border border-border bg-surface-1 px-3 t-small text-text-1"
            >
              <option value="">All 30 teams</option>
              {teams.map((t) => (
                <option key={t.abbrev} value={t.abbrev}>{t.name}</option>
              ))}
            </select>
            <Segmented aria-label="Position" options={POSITIONS} value={filters.position || ''} onChange={(v) => set('pos', v)} />
            <Segmented aria-label="Conference" options={CONFERENCES} value={filters.conference || ''} onChange={(v) => set('conf', v)} />
          </div>
        </div>

        {failed ? (
          <PageState kind="error" title="Couldn't load this list." onRetry={() => setNonce((n) => n + 1)} />
        ) : !data ? (
          <Skeleton variant="rectangle" height="h-64" className="rounded-lg" />
        ) : data.rows.length === 0 ? (
          <PageState kind="empty" title="No qualified players match these filters." />
        ) : (
          <>
            <CategoryTable category={category} data={data} />
            <div className="flex flex-wrap items-center justify-between gap-2 t-small text-text-2">
              <span>
                {data.matching > data.rows.length
                  ? `Top ${data.rows.length} of ${data.matching} qualified players`
                  : `${data.matching} qualified ${data.matching === 1 ? 'player' : 'players'}`}
              </span>
              <Link to={`/stats/leaders/${catId}`} className="inline-flex items-center min-h-[44px] text-accent hover:text-accent-hover">
                See the top 25 in League leaders
              </Link>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

const num = (v) => parseFloat(String(v ?? '').replace('+', '')) || 0;
const TEAM_SORTS = {
  team: (t) => t.team,
  record: (t) => num(String(t.record).split('-')[0]) / Math.max(1, num(String(t.record).split('-')[0]) + num(String(t.record).split('-')[1])),
};

function TeamsView({ teamStats, teams }) {
  const [sort, setSort] = useState({ key: 'diff', dir: 'desc' });
  const [conf, setConf] = useState('');
  const confOf = useMemo(() => Object.fromEntries(teams.map((t) => [t.abbrev, (t.conference || '').toLowerCase()])), [teams]);
  const signed = (v) => (v && !String(v).startsWith('-') ? `+${v}` : v);

  const rows = useMemo(() => {
    const keyOf = TEAM_SORTS[sort.key] || ((t) => num(t[sort.key]));
    const shown = teamStats.filter((t) => !conf || (confOf[t.abbrev] || '').startsWith(conf));
    return [...shown]
      .sort((a, b) => {
        const x = keyOf(a);
        const y = keyOf(b);
        const order = typeof x === 'string' ? x.localeCompare(y) : x - y;
        return sort.dir === 'desc' ? -order : order;
      })
      .map((t, i) => ({ ...t, place: i + 1 }));
  }, [teamStats, conf, confOf, sort]);

  const onSortChange = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'team' ? 'asc' : 'desc' }));

  const columns = [
    { key: 'place', label: '#', numeric: true },
    {
      key: 'team',
      label: 'Team',
      sortable: true,
      render: (t) => (
        <TeamLink abbrev={t.abbrev} className="flex items-center gap-2.5 text-text-1 hover:text-accent">
          <img src={getLogoUrl(t.abbrev)} alt="" width={24} height={24} loading="lazy" className="h-6 w-6 shrink-0 object-contain" />
          <span className="font-semibold whitespace-nowrap">{t.team}</span>
        </TeamLink>
      ),
    },
    { key: 'record', label: 'W-L', numeric: true, sortable: true },
    { key: 'ppg', label: 'PTS', numeric: true, sortable: true },
    { key: 'opp_ppg', label: 'OPP', numeric: true, sortable: true },
    { key: 'diff', label: 'DIFF', numeric: true, sortable: true, render: (t) => <span className="tnum font-semibold text-text-1">{signed(t.diff)}</span> },
    { key: 'fg_pct', label: 'FG%', numeric: true, sortable: true },
    { key: 'three_pct', label: '3P%', numeric: true, sortable: true },
    { key: 'ft_pct', label: 'FT%', numeric: true, sortable: true },
    { key: 'rpg', label: 'REB', numeric: true, sortable: true },
    { key: 'apg', label: 'AST', numeric: true, sortable: true },
    { key: 'spg', label: 'STL', numeric: true, sortable: true },
    { key: 'bpg', label: 'BLK', numeric: true, sortable: true },
    { key: 'tov', label: 'TOV', numeric: true, sortable: true },
  ];

  if (teamStats.length === 0) return <PageState kind="empty" title="Team stats aren't available yet." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="t-section text-text-1">Team stats, per game</h2>
        <Segmented aria-label="Teams conference" options={CONFERENCES} value={conf} onChange={setConf} />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getKey={(t) => t.abbrev || t.team}
        sort={sort}
        onSortChange={onSortChange}
        rowLink={(t) => (t.abbrev ? `/team/${t.abbrev}` : null)}
      />
    </div>
  );
}

export default function StatsPage() {
  usePageMeta('Stats', "NBA leaders under the league's qualifying rules, and every team's numbers.");
  const [view, setView] = useState('players');
  const [leaders, setLeaders] = useState({});
  const [seasonLabel, setSeasonLabel] = useState('');
  const [teamStats, setTeamStats] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([fetchStatLeaders(1), fetchTeamStatsList(), fetchTeams().catch(() => [])])
      .then(([leadersData, teamsData, teamList]) => {
        if (cancelled) return;
        setLeaders(leadersData?.categories || {});
        setSeasonLabel(leadersData?.season_label || '');
        setTeamStats(teamsData || []);
        setTeams([...(teamList || [])].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retryNonce]);

  if (error) return <PageState kind="error" title="Couldn't load stats." onRetry={() => setRetryNonce((n) => n + 1)} />;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="t-title text-text-1">Stats</h1>
          {seasonLabel && <p className="t-small text-text-2 mt-1">{seasonLabel}</p>}
        </div>
        <Segmented
          aria-label="Stats view"
          options={[
            { id: 'players', label: 'Players' },
            { id: 'teams', label: 'Teams' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {loading ? (
        <Skeleton variant="rectangle" height="h-96" className="rounded-lg" />
      ) : view === 'players' ? (
        <PlayersView leaders={leaders} teams={teams} />
      ) : (
        <TeamsView teamStats={teamStats} teams={teams} />
      )}
    </div>
  );
}
