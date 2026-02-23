import { useEffect, useState } from "react";
import { fetchModelPicks } from "@/services/api";
import { Badge } from "@/components/ui";
import { TrendingUp, Lock } from "lucide-react";

const TIER_VARIANT = {
  X: "warning",
  Z: "info",
  META: "primary",
  Goldmine: "warning",
  star_tier: "success",
  A: "gray",
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
  const pct = Math.round(ratio * 100);
  const isOver = prediction?.toUpperCase() === "OVER";

  let barColor;
  if (isHit === true) barColor = "var(--green)";
  else if (isHit === false) barColor = "var(--red)";
  else if (isOver && actual > line) barColor = "var(--green)";
  else if (!isOver && actual < line) barColor = "var(--green)";
  else barColor = "var(--accent, #6366f1)";

  return (
    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden mt-1.5">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.min(pct, 100)}%`,
          backgroundColor: barColor,
          boxShadow: `0 0 8px ${barColor}40`,
        }}
      />
    </div>
  );
}

function PickCard({ pick }) {
  const actual = pick.actual_value;
  const line = pick.line;
  const isGated = pick.is_gated;

  return (
    <div className="relative flex items-center gap-3 px-4 py-3 group/pick">
      {/* Gated overlay */}
      {isGated && (
        <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm bg-black/40 rounded-lg">
          <div className="flex items-center gap-2 text-[11px] font-black text-white/60 uppercase tracking-widest">
            <Lock className="h-3.5 w-3.5" />
            Premium
          </div>
        </div>
      )}

      {/* Tier badge */}
      <Badge variant={TIER_VARIANT[pick.tier] ?? "gray"} size="sm">
        {pick.tier ?? "\u2013"}
      </Badge>

      {/* Player + market + progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white truncate">{pick.player_name}</p>
          <span className="text-[10px] font-black text-white/30 uppercase tracking-wider">
            {MARKET_LABEL[pick.market] || pick.market}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-white/40 tabular-nums">
          <span>{pick.prediction}</span>
          {!isGated && <span>{line}</span>}
          {pick.book && !isGated && <span className="text-white/20">&middot; {pick.book}</span>}
        </div>
        {!isGated && <ProgressBar actual={actual} line={line} isHit={pick.is_hit} prediction={pick.prediction} />}
      </div>

      {/* Actual vs line */}
      <div className="flex-shrink-0 text-right tabular-nums">
        {actual != null ? (
          <span className="text-lg font-black text-white">{actual}</span>
        ) : (
          <span className="text-lg font-black text-white/15">&ndash;</span>
        )}
        {!isGated && line != null && (
          <p className="text-[11px] text-white/30 font-bold">/ {line}</p>
        )}
      </div>

      {/* Hit/miss badge */}
      <div className="flex-shrink-0 w-6 text-center">
        {pick.is_hit === true ? (
          <span className="text-sm font-black text-[var(--green)] animate-fadeIn">W</span>
        ) : pick.is_hit === false ? (
          <span className="text-sm font-black text-[var(--red)] animate-fadeIn">L</span>
        ) : (
          <span className="text-sm text-white/10">&middot;</span>
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
        <div className="h-16 animate-pulse rounded-2xl bg-white/[0.02] border border-white/5" />
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
      {/* Section header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-3 mb-3 w-full group"
      >
        <TrendingUp className="h-4.5 w-4.5 text-indigo-400/60" />
        <span className="text-[12px] font-black text-white/40 uppercase tracking-[0.3em]">
          AI Picks
        </span>
        <div className="flex items-center gap-2 ml-auto text-[12px] tabular-nums font-bold">
          {wr !== null && (
            <span className={wr >= 60 ? "text-[var(--green)]" : "text-white/40"}>
              {wr}%
            </span>
          )}
          <span className="text-[var(--green)]">{hits}W</span>
          <span className="text-[var(--red)]">{misses}L</span>
          {pending > 0 && <span className="text-white/20">{pending}P</span>}
        </div>
        <span className="text-white/20 text-xs transition-transform group-hover:text-white/40" style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0)" }}>
          &#9660;
        </span>
      </button>

      {/* Pick cards */}
      {!collapsed && (
        <div className="rounded-2xl overflow-hidden liquid-mirror border-white/10 divide-y divide-white/[0.04]">
          {picks.map((pick) => (
            <PickCard key={pick.id} pick={pick} />
          ))}
        </div>
      )}
    </div>
  );
}
