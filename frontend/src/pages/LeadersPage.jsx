import { useEffect, useState } from 'react';
import { PlayerLink } from '@/components/sport/PlayerLink';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DataTable, PageState, SectionHeader, Segmented } from '@/components/ui';
import { fetchStatLeaders } from '@/services/api';
import { PlayerHeadshot } from '@/components/sport/PlayerHeadshot';
import { usePageMeta } from '@/hooks/usePageMeta';

// Every category the API serves, in the order the Stats page shows them.
export const CATEGORIES = [
  { id: 'pts', label: 'Points', unit: 'PPG' },
  { id: 'ast', label: 'Assists', unit: 'APG' },
  { id: 'threes', label: 'Three pointers', unit: '3PM' },
  { id: 'reb', label: 'Rebounds', unit: 'RPG' },
  { id: 'blk', label: 'Blocks', unit: 'BPG' },
  { id: 'stl', label: 'Steals', unit: 'SPG' },
  { id: 'fg_pct', label: 'Field goal %', unit: 'FG%' },
  { id: 'three_pct', label: 'Three-point %', unit: '3P%' },
  { id: 'ft_pct', label: 'Free throw %', unit: 'FT%' },
];

const DEPTH = 25; // as many as the API serves per category

export default function LeadersPage() {
  usePageMeta('League leaders', "NBA leaders under the league's qualifying rules, and every team's numbers.");
  const { category } = useParams();
  const navigate = useNavigate();
  const current = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    fetchStatLeaders(DEPTH)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [retryNonce]);

  const rows = data?.categories?.[current.id] ?? [];
  const columns = [
    { key: 'rank', label: 'Rk', numeric: true },
    {
      key: 'player',
      label: 'Player',
      render: (row) => (
        <PlayerLink id={row.player_id} className="flex items-center gap-3 font-semibold text-text-1 hover:text-accent">
          <span className="h-10 w-10 rounded-md bg-surface-2 border border-border overflow-hidden shrink-0">
            <PlayerHeadshot
              url={row.headshot_url}
              px={40}
              alt={row.player}
              className="w-full h-full object-cover"
              fallback={<span className="w-full h-full flex items-center justify-center t-small text-text-3">{row.player[0]}</span>}
            />
          </span>
          <span>{row.player}</span>
        </PlayerLink>
      ),
    },
    { key: 'team', label: 'Team' },
    { key: 'value', label: current.unit, numeric: true, render: (row) => <span className="tnum font-semibold text-text-1">{row.value}</span> },
  ];

  return (
    <div className="max-w-[1100px] mx-auto space-y-10 pb-40 px-4 pt-10">
      <div className="space-y-3 border-b border-border pb-8">
        <Link to="/stats" className="t-label text-text-3 hover:text-accent">Stats</Link>
        <h1 className="t-title text-text-1">League leaders</h1>
        {data?.season_label && <p className="t-label text-text-3">{data.season_label}</p>}
      </div>

      <Segmented
        aria-label="Stat category"
        options={CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
        value={current.id}
        onChange={(id) => navigate(`/stats/leaders/${id}`)}
        className="flex-wrap"
      />

      {error ? (
        <PageState kind="error" onRetry={() => setRetryNonce((n) => n + 1)} />
      ) : !data ? (
        <PageState kind="loading" />
      ) : rows.length === 0 ? (
        <PageState kind="empty" title="No leaders for this category yet." />
      ) : (
        <section className="space-y-4">
          <SectionHeader title={current.label} aside={`Top ${rows.length}`} />
          <DataTable columns={columns} rows={rows} getKey={(row) => `${row.player_id}-${row.rank}`} rowLink={(row) => (row.player_id ? `/player/${row.player_id}` : null)} />
        </section>
      )}
    </div>
  );
}
