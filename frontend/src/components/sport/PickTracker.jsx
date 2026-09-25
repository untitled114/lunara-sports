import { useEffect, useState } from "react";
import { Badge, Card, Skeleton } from "@/components/ui";
import { TrendingUp, Lock } from "lucide-react";
import { fetchModelPicks } from "@/services/api";

const TIER_VARIANT = {
  X: "warn",
  Z: "accent",
  META: "accent",
  Goldmine: "warn",
  star_tier: "win",
  A: "neutral",
};

const MARKET_LABEL = {
  POINTS: "PTS",
  REBOUNDS: "REB",
  ASSISTS: "AST",
  THREES: "3PT",
  STEALS: "STL",
  BLOCKS: "BLK",
};

function ProgressBar({ actual, line, isHit, prediction }) {
  if (actual == null || line == null || line === 0) return null;

  const ratio = Math.min(actual / line, 1.5);
  const pct = Math.min(Math.round(ratio * 100), 100);
  const isOver = prediction?.toUpperCase() === "OVER";

  let barClass = "bg-text-3";
  if (isHit === true) barClass = "bg-live";
  else if (isHit === false) barClass = "bg-loss";
  else if (isOver && actual > line) barClass = "bg-live";
  else if (!isOver && actual < line) barClass = "bg-live";

  return (
    <div className="w-full h-1.5 rounded-sm bg-surface-2 overflow-hidden mt-1.5">
      <div className={`h-full ${barClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function PickCard({ pick }) {
  const actual = pick.actual_value;
  const line = pick.line;
  const isGated = pick.is_gated;

  return (
    <div className="relative flex items-center gap-3 py-3">
      {/* Gated overlay */}
      {isGated && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-1">
          <span className="flex items-center gap-2 t-label text-text-3">
            <Lock className="h-3.5 w-3.5" /> Premium
          </span>
        </div>
      )}

      {/* Tier badge */}
      <Badge variant={TIER_VARIANT[pick.tier] ?? "neutral"}>{pick.tier ?? "–"}</Badge>

      {/* Player + market + progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="t-small font-semibold text-text-1 truncate">{pick.player_name}</p>
          <span className="t-label text-text-3">{MARKET_LABEL[pick.market] || pick.market}</span>
        </div>
        <div className="flex items-center gap-2 t-small tnum text-text-3">
          <span>{pick.prediction}</span>
          {!isGated && <span>{line}</span>}
          {pick.book && !isGated && <span>&middot; {pick.book}</span>}
        </div>
        {!isGated && <ProgressBar actual={actual} line={line} isHit={pick.is_hit} prediction={pick.prediction} />}
      </div>

      {/* Actual vs line */}
      <div className="shrink-0 text-right tnum">
        {actual != null ? (
          <span className="t-body font-semibold text-text-1">{actual}</span>
        ) : (
          <span className="t-body text-text-3">&ndash;</span>
        )}
        {!isGated && line != null && <p className="t-small text-text-3">/ {line}</p>}
      </div>

      {/* Hit/miss indicator */}
      <div className="shrink-0 w-6 text-center">
        {pick.is_hit === true ? (
          <span className="t-small font-semibold text-live">W</span>
        ) : pick.is_hit === false ? (
          <span className="t-small font-semibold text-loss">L</span>
        ) : (
          <span className="t-small text-text-3">&middot;</span>
        )}
      </div>
    </div>
  );
}

export function PickTracker({ gameId, pickUpdates }) {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    fetchModelPicks(gameId)
      .then((data) => { if (!cancelled) setPicks(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [gameId]);

  // Apply WebSocket pick updates
  useEffect(() => {
    if (!pickUpdates?.picks) return;
    setPicks((prev) => {
      const updated = [...prev];
      for (const u of pickUpdates.picks) {
        const idx = updated.findIndex((p) => p.id === u.id);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], ...u };
        }
      }
      return updated;
    });
  }, [pickUpdates]);

  if (loading) {
    return (
      <div className="mt-4 sm:mt-5 lg:mt-6">
        <Skeleton variant="rectangle" height="h-16" className="rounded-lg" />
      </div>
    );
  }

  if (picks.length === 0) return null;

  const hits = picks.filter((p) => p.is_hit === true).length;
  const misses = picks.filter((p) => p.is_hit === false).length;
  const pending = picks.filter((p) => p.is_hit == null).length;
  const total = hits + misses;
  const wr = total > 0 ? Math.round((hits / total) * 100) : null;

  return (
    <div className="mt-4 sm:mt-5 lg:mt-6">
      <Card>
        <button
          type="button"
          aria-label="Toggle AI picks section"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-3 w-full"
        >
          <TrendingUp className="h-4 w-4 text-text-3" />
          <span className="t-label text-text-3">AI picks</span>
          <div className="flex items-center gap-2 ml-auto t-small tnum font-semibold">
            {wr !== null && (
              <span className={wr >= 60 ? "text-live" : "text-text-2"}>{wr}%</span>
            )}
            <span className="text-live">{hits}W</span>
            <span className="text-loss">{misses}L</span>
            {pending > 0 && <span className="text-text-3">{pending}P</span>}
          </div>
          <span className="text-text-3" aria-hidden="true">{collapsed ? "▶" : "▼"}</span>
        </button>

        {!collapsed && (
          <div className="mt-3 divide-y divide-border">
            {picks.map((pick) => (
              <PickCard key={pick.id} pick={pick} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
