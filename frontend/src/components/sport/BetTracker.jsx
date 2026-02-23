import { useEffect, useState } from "react";
import { fetchModelPicks } from "@/services/api";
import { Badge } from "@/components/ui";

const TIER_STYLE = {
  X: "bg-yellow-500/15 text-yellow-400",
  Z: "bg-blue-500/15 text-blue-400",
  META: "bg-purple-500/15 text-purple-400",
  A: "bg-[var(--bg-card-alt)] text-[var(--text-muted)]",
};

const TIER_VARIANT = {
  X: "warning",
  Z: "info",
  META: "primary",
  A: "gray",
};

export function BetTracker({ gameId }) {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchModelPicks(gameId)
      .then((data) => { if (!cancelled) setPicks(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [gameId]);

  const hits = picks.filter((p) => p.is_hit === true).length;
  const misses = picks.filter((p) => p.is_hit === false).length;
  const pending = picks.filter((p) => p.is_hit === null).length;
  const total = hits + misses;
  const wr = total > 0 ? Math.round((hits / total) * 100) : null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
        <span className="text-sm font-bold uppercase tracking-wider text-[var(--accent)]">Picks</span>
        {!loading && picks.length > 0 && (
          <div className="flex items-center gap-2 text-sm tabular-nums">
            {wr !== null && <span className={`font-bold ${wr >= 60 ? "text-[var(--green)]" : "text-[var(--text-secondary)]"}`}>{wr}%</span>}
            <span className="text-[var(--green)]">{hits}W</span>
            <span className="text-[var(--red)]">{misses}L</span>
            {pending > 0 && <span className="text-[var(--text-muted)]">{pending}P</span>}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
        {loading ? (
          <div className="p-4"><div className="h-20 animate-pulse rounded-lg bg-[var(--bg-card-alt)]" /></div>
        ) : picks.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--text-muted)]">No picks for this game</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {picks.map((pick) => (
              <div
                key={pick.id}
                className="flex items-center gap-2.5 px-4 py-2.5"
              >
                {/* Tier */}
                <Badge variant={TIER_VARIANT[pick.tier] ?? "gray"} size="sm">
                  {pick.tier ?? "\u2013"}
                </Badge>

                {/* Player + line */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{pick.player_name}</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {pick.market} {pick.prediction} {pick.line}
                    <span className="ml-1 text-[var(--text-muted)]">&middot; {pick.book}</span>
                  </p>
                </div>

                {/* Actual + edge */}
                <div className="flex-shrink-0 text-right">
                  {pick.actual_value !== null ? (
                    <span className="text-sm tabular-nums font-semibold text-white">{pick.actual_value}</span>
                  ) : (
                    <span className="text-sm text-[var(--text-muted)]">&ndash;</span>
                  )}
                  <p className="text-[13px] tabular-nums text-[var(--text-muted)]">
                    {pick.model_version?.toUpperCase()} +{pick.edge}%
                  </p>
                </div>

                {/* Result */}
                <span className={`flex-shrink-0 text-sm font-bold ${
                  pick.is_hit === true ? "text-[var(--green)]"
                    : pick.is_hit === false ? "text-[var(--red)]"
                    : "text-[var(--text-muted)]"
                }`}>
                  {pick.is_hit === true ? "W" : pick.is_hit === false ? "L" : "\u00B7"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
