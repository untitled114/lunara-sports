import { Badge } from "@/components/ui";
import { Lock, TrendingUp, TrendingDown } from "lucide-react";

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
    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
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

export function PickCard({ pick, delay = 0 }) {
  const actual = pick.actual_value;
  const line = pick.line;
  const isGated = pick.is_gated;
  const isOver = pick.prediction?.toUpperCase() === "OVER";
  const edge = pick.edge;
  const edgePct = pick.edge_pct;
  const modelVersion = pick.model_version;

  return (
    <div
      className="liquid-mirror rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl animate-fadeIn transition-all duration-500 hover:border-white/20 group/card relative"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Gated overlay */}
      {isGated && (
        <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-md bg-black/50 rounded-[2.5rem]">
          <div className="flex flex-col items-center gap-3">
            <Lock className="h-6 w-6 text-white/40" />
            <span className="text-[11px] font-black text-white/50 uppercase tracking-[0.3em]">Premium Pick</span>
          </div>
        </div>
      )}

      {/* Card header — tier + model version */}
      <div className="flex items-center justify-between px-7 pt-6 pb-3">
        <Badge variant={TIER_VARIANT[pick.tier] ?? "gray"} size="sm">
          {pick.tier ?? "\u2013"}
        </Badge>
        <div className="flex items-center gap-2">
          {modelVersion && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                modelVersion === "v3"
                  ? "bg-emerald-900/30 text-emerald-300 border-emerald-500/30"
                  : "bg-indigo-900/30 text-indigo-300 border-indigo-500/30"
              }`}
            >
              {modelVersion.toUpperCase()}
            </span>
          )}
          <span className="text-[10px] font-black text-white/20 uppercase tracking-wider">
            {MARKET_LABEL[pick.market] || pick.market}
          </span>
        </div>
      </div>

      {/* Player info */}
      <div className="px-7 pb-4">
        <p className="text-lg font-black text-white uppercase tracking-tight truncate group-hover/card:text-indigo-400 transition-colors">
          {pick.player_name}
        </p>
        <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-white/40 uppercase tracking-widest">
          {pick.team && <span>{pick.team}</span>}
          {pick.opponent_team && (
            <>
              <span className="text-white/10">vs</span>
              <span>{pick.opponent_team}</span>
            </>
          )}
          {pick.is_home != null && (
            <span className="text-white/15">{pick.is_home ? "(H)" : "(A)"}</span>
          )}
        </div>
      </div>

      {/* Prediction + line */}
      <div className="px-7 pb-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black uppercase tracking-widest ${
              isOver
                ? "bg-green-900/20 text-green-400 border border-green-500/20"
                : "bg-red-900/20 text-red-400 border border-red-500/20"
            }`}
          >
            {isOver ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {pick.prediction}
          </div>
          {!isGated && line != null && (
            <span className="text-2xl font-black text-white tabular-nums">{line}</span>
          )}
        </div>
        {!isGated && pick.book && (
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mt-2">
            {pick.book}
          </p>
        )}
      </div>

      {/* Edge display */}
      {!isGated && (edge != null || edgePct != null) && (
        <div className="flex items-center gap-4 px-7 pb-3">
          {edge != null && (
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Edge</span>
              <span
                className={`text-sm font-black tabular-nums ${
                  edge >= 3 ? "text-green-400" : edge >= 1 ? "text-yellow-400" : "text-white/50"
                }`}
              >
                {edge > 0 ? "+" : ""}{typeof edge === "number" ? edge.toFixed(1) : edge}
              </span>
            </div>
          )}
          {edgePct != null && (
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Edge %</span>
              <span
                className={`text-sm font-black tabular-nums ${
                  edgePct >= 20 ? "text-green-400" : edgePct >= 10 ? "text-yellow-400" : "text-white/50"
                }`}
              >
                {typeof edgePct === "number" ? edgePct.toFixed(1) : edgePct}%
              </span>
            </div>
          )}
          {pick.p_over != null && (
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Confidence</span>
              <span className="text-sm font-black tabular-nums text-white/60">
                {(pick.p_over * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Progress bar + actual */}
      {!isGated && (
        <div className="px-7 pb-3">
          <ProgressBar actual={actual} line={line} isHit={pick.is_hit} prediction={pick.prediction} />
          {actual != null && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Actual</span>
              <span className="text-lg font-black text-white tabular-nums">
                {actual}
                <span className="text-white/20 text-sm font-bold ml-1">/ {line}</span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Result badge */}
      <div className="px-7 pb-6 pt-1">
        {pick.is_hit === true ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-900/20 border border-green-500/20 w-fit">
            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            <span className="text-[11px] font-black text-green-400 uppercase tracking-[0.3em]">Hit</span>
          </div>
        ) : pick.is_hit === false ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-900/20 border border-red-500/20 w-fit">
            <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
            <span className="text-[11px] font-black text-red-400 uppercase tracking-[0.3em]">Miss</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 w-fit">
            <div className="h-2 w-2 rounded-full bg-white/20 animate-pulse" />
            <span className="text-[11px] font-black text-white/30 uppercase tracking-[0.3em]">Pending</span>
          </div>
        )}
      </div>
    </div>
  );
}
