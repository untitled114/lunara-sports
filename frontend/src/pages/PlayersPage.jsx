import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DataTable, PageState, Segmented, Skeleton } from '@/components/ui';
import { fetchPlayerTable, fetchTeams } from '@/services/api';
import { getHeadshotUrl, getLogoUrl } from '@/utils/teamColors';
import { PlayerLink } from '@/components/sport/PlayerLink';
import { usePageMeta } from '@/hooks/usePageMeta';

// One table of every player who has played this season, sortable by any column,
// 25 per page, with search, filters and the games rule. Its state lives in the URL.
const TEXT_SORTS = new Set(['player', 'team', 'position']);

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

const num = (key, label) => ({ key, label, numeric: true, sortable: true, render: (r) => r[key] || '-' });

const COLUMNS = [
  {
    key: 'player',
    label: 'Player',
    sortable: true,
    sticky: true,
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
        <span className="truncate max-w-[130px] sm:max-w-[190px] font-semibold" title={r.player}>{r.player}</span>
      </PlayerLink>
    ),
  },
  {
    key: 'team',
    label: 'Team',
    sortable: true,
    nowrap: true,
    render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <img src={getLogoUrl(r.team)} alt="" width={18} height={18} loading="lazy" className="h-[18px] w-[18px] shrink-0" />
        {r.team}
      </span>
    ),
  },
  { key: 'position', label: 'Pos', sortable: true, render: (r) => r.position || '-' },
  { key: 'age', label: 'Age', numeric: true, sortable: true, render: (r) => r.age ?? '-' },
  { key: 'gp', label: 'GP', numeric: true, sortable: true, render: (r) => r.gp ?? '-' },
  num('min', 'MIN'),
  num('pts', 'PTS'),
  num('reb', 'REB'),
  num('ast', 'AST'),
  num('threes', '3PM'),
  num('stl', 'STL'),
  num('blk', 'BLK'),
  num('fg_pct', 'FG%'),
  num('three_pct', '3P%'),
  num('ft_pct', 'FT%'),
];

// The pages to offer around the current one: first, last, and two either side.
function pageList(page, pages) {
  const set = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2]);
  return [...set].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
}

export default function PlayersPage() {
  usePageMeta('Players', "Every NBA player's season, game log and career.");
  const [params, setParams] = useSearchParams();
  const [typed, setTyped] = useState(params.get('q') || '');
  const [teams, setTeams] = useState([]);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  // The request: only what differs from the defaults (points, high to low, page 1, games rule on).
  const query = useMemo(() => {
    const q = {};
    if (params.get('sort') && params.get('sort') !== 'pts') q.sort = params.get('sort');
    if (params.get('dir') === 'asc') q.dir = 'asc';
    if (Number(params.get('page')) > 1) q.page = Number(params.get('page'));
    if (params.get('q')) q.q = params.get('q');
    if (params.get('team')) q.team = params.get('team');
    if (params.get('pos')) q.position = params.get('pos');
    if (params.get('conf')) q.conference = params.get('conf');
    if (params.get('all') === '1') q.all = true;
    return q;
  }, [params]);

  const update = (changes, keepPage = false) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value === null || value === undefined || value === false) next.delete(key);
      else next.set(key, String(value));
    }
    if (!keepPage) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    fetchTeams()
      .then((list) => setTeams([...(list || [])].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {});
  }, []);

  // Search waits for a pause in typing.
  useEffect(() => {
    if (typed === (params.get('q') || '')) return undefined;
    const id = setTimeout(() => update({ q: typed.trim() }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed]);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    fetchPlayerTable(query)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [query, nonce]);

  const sortKey = query.sort || 'pts';
  const sortDir = query.dir || (query.sort && TEXT_SORTS.has(query.sort) ? 'asc' : 'desc');
  const onSortChange = (key) => {
    if (key === sortKey) {
      update({ sort: key === 'pts' ? '' : key, dir: query.dir === 'asc' ? '' : 'asc' });
    } else {
      update({ sort: key === 'pts' ? '' : key, dir: TEXT_SORTS.has(key) ? 'asc' : '' });
    }
  };

  const total = data?.total ?? 0;
  const perPage = data?.per_page ?? 25;
  const page = data?.page ?? 1;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const first = total ? (page - 1) * perPage + 1 : 0;
  const last = Math.min(total, page * perPage);

  return (
    <div className="space-y-5 pb-16">
      <div>
        <h1 className="t-title text-text-1">Players</h1>
        <p className="t-small text-text-2 mt-1">{data?.season_label ? `${data.season_label}, per game` : 'Per game'}</p>
      </div>

      <div className="space-y-3">
        <input
          type="search"
          aria-label="Search players"
          placeholder={'Search a name, a team, or a team and number ("knicks 11")'}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="w-full min-h-[44px] rounded-md border border-border bg-surface-1 px-3 t-body text-text-1 placeholder:text-text-3"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Team"
            value={query.team || ''}
            onChange={(e) => update({ team: e.target.value })}
            className="min-h-[44px] sm:min-h-[36px] rounded-md border border-border bg-surface-1 px-3 t-small text-text-1"
          >
            <option value="">All 30 teams</option>
            {teams.map((t) => (
              <option key={t.abbrev} value={t.abbrev}>{t.name}</option>
            ))}
          </select>
          <Segmented aria-label="Position" options={POSITIONS} value={query.position || ''} onChange={(v) => update({ pos: v })} />
          <Segmented aria-label="Conference" options={CONFERENCES} value={query.conference || ''} onChange={(v) => update({ conf: v })} />
          <label className="inline-flex items-center gap-2 min-h-[44px] sm:min-h-[36px] t-small text-text-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!query.all}
              onChange={(e) => update({ all: e.target.checked ? '' : '1' })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            {"Played 70% of his team's games"}
          </label>
        </div>
      </div>

      {failed ? (
        <PageState kind="error" title="Couldn't load players." onRetry={() => setNonce((n) => n + 1)} />
      ) : !data ? (
        <Skeleton variant="rectangle" height="h-96" className="rounded-lg" />
      ) : data.rows.length === 0 ? (
        <PageState kind="empty" title="No players match." />
      ) : (
        <>
          <DataTable
            compact
            columns={COLUMNS}
            rows={data.rows}
            getKey={(r) => r.player_id}
            rowLink={(r) => `/player/${r.player_id}`}
            sort={{ key: sortKey, dir: sortDir }}
            onSortChange={onSortChange}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="t-small text-text-2 tnum">{`Showing ${first}-${last} of ${total}`}</span>
            <nav aria-label="Pages" className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => update({ page: page - 1 }, true)}
                className="min-h-[44px] sm:min-h-[36px] px-3 rounded-md border border-border t-small text-text-1 disabled:opacity-40"
              >
                Previous
              </button>
              {pageList(page, pages).map((n, i, list) => (
                <span key={n} className="inline-flex items-center gap-1">
                  {i > 0 && n - list[i - 1] > 1 && <span className="px-1 text-text-3">...</span>}
                  <button
                    type="button"
                    aria-current={n === page ? 'page' : undefined}
                    onClick={() => update({ page: n === 1 ? '' : n }, true)}
                    className={`min-h-[44px] sm:min-h-[36px] min-w-[36px] px-2 rounded-md border t-small tnum ${n === page ? 'bg-accent-fill text-accent-ink border-transparent' : 'border-border text-text-1'}`}
                  >
                    {n}
                  </button>
                </span>
              ))}
              <button
                type="button"
                aria-label="Next page"
                disabled={page >= pages}
                onClick={() => update({ page: page + 1 }, true)}
                className="min-h-[44px] sm:min-h-[36px] px-3 rounded-md border border-border t-small text-text-1 disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
