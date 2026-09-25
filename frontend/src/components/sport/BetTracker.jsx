import { useEffect, useState } from 'react';
import { fetchModelPicks } from '@/services/api';
import { Badge } from '@/components/ui';
import clsx from 'clsx';

const TIER_VARIANT = {
  X: 'warn',
  Z: 'accent',
  META: 'accent',
  A: 'neutral',
};

export function BetTracker({ gameId }) {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchModelPicks(gameId)
      .then((data) => {
        if (!cancelled) setPicks(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const hits = picks.filter((p) => p.is_hit === true).length;
  const misses = picks.filter((p) => p.is_hit === false).length;
  const pending = picks.filter((p) => p.is_hit === null).length;
  const total = hits + misses;
  const wr = total > 0 ? Math.round((hits / total) * 100) : null;

  return (
    <div className="rounded-lg border border-border bg-surface-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="t-label text-accent">Picks</span>
        {!loading && picks.length > 0 && (
          <div className="flex items-center gap-2 t-small tnum">
            {wr !== null && <span className={clsx('font-semibold', wr >= 60 ? 'text-live' : 'text-text-2')}>{wr}%</span>}
            <span className="text-live">{hits}W</span>
            <span className="text-loss">{misses}L</span>
            {pending > 0 && <span className="text-text-3">{pending}P</span>}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
        {loading ? (
          <div className="p-4">
            <div className="h-20 animate-pulse rounded-md bg-surface-2" />
          </div>
        ) : picks.length === 0 ? (
          <p className="py-10 text-center t-small text-text-3">No picks for this game.</p>
        ) : (
          <div className="divide-y divide-border">
            {picks.map((pick) => (
              <div key={pick.id} className="flex items-center gap-2.5 px-4 py-2.5">
                {/* Tier */}
                <Badge variant={TIER_VARIANT[pick.tier] ?? 'neutral'}>{pick.tier ?? '–'}</Badge>

                {/* Player + line */}
                <div className="flex-1 min-w-0">
                  <p className="t-small font-medium text-text-1 truncate">{pick.player_name}</p>
                  <p className="t-small text-text-3">
                    {pick.market} {pick.prediction} {pick.line}
                    <span className="ml-1 text-text-3">&middot; {pick.book}</span>
                  </p>
                </div>

                {/* Actual + edge */}
                <div className="flex-shrink-0 text-right">
                  {pick.actual_value !== null ? (
                    <span className="t-small tnum font-semibold text-text-1">{pick.actual_value}</span>
                  ) : (
                    <span className="t-small text-text-3">&ndash;</span>
                  )}
                  <p className="t-small tnum text-text-3">
                    {pick.model_version?.toUpperCase()} +{pick.edge}%
                  </p>
                </div>

                {/* Result */}
                <span
                  className={clsx(
                    'flex-shrink-0 t-small font-semibold',
                    pick.is_hit === true ? 'text-live' : pick.is_hit === false ? 'text-loss' : 'text-text-3'
                  )}
                >
                  {pick.is_hit === true ? 'W' : pick.is_hit === false ? 'L' : '·'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
