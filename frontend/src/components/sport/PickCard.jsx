import { TrendingUp, TrendingDown, Check, X, Clock } from "lucide-react";

const MARKET_LABEL = {
  POINTS: "PTS",
  REBOUNDS: "REB",
  ASSISTS: "AST",
  THREES: "3PT",
  STEALS: "STL",
  BLOCKS: "BLK",
};

const TIER_STYLE = {
  X: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/25" },
  Z: { bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/25" },
  META: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/25" },
  Goldmine: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/25" },
  star_tier: { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/25" },
  A: { bg: "bg-white/5", text: "text-white/50", border: "border-white/10" },
};

function formatBook(book) {
  if (!book) return null;
  return book
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ProgressBar({ actual, line, isHit, prediction }) {
  if (actual == null || line == null || line === 0) return null;

  const pct = Math.min(Math.round((actual / line) * 100), 150);
  const isOver = prediction?.toUpperCase() === "OVER";

  let color;
  if (isHit === true) color = "#22c55e";
  else if (isHit === false) color = "#ef4444";
  else if ((isOver && actual >= line) || (!isOver && actual <= line)) color = "#22c55e";
  else color = "#6366f1";

  return (
    <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function PickCard({ pick, delay = 0 }) {
  const actual = pick.actual_value;
  const line = pick.line;
  const isOver = pick.prediction?.toUpperCase() === "OVER";
  const edge = pick.edge;
  const edgePct = pick.edge_pct;
  const tier = pick.tier;
  const tierStyle = TIER_STYLE[tier] || TIER_STYLE.A;
  const market = MARKET_LABEL[pick.market] || pick.market;
  const model = pick.model_version?.toUpperCase();
  const book = formatBook(pick.book);

  const cleared = actual != null && line != null && line > 0 && (
    (isOver && actual >= line) || (!isOver && actual <= line)
  );

  return (
    <div
      className="rounded-2xl border border-white/[0.06] overflow-hidden animate-fadeIn transition-all duration-300 hover:border-white/[0.12] group relative"
      style={{ backgroundColor: "#0f1116", animationDelay: `${delay}s` }}
    >
      {/* Top section */}
      <div className="p-5 pb-4">
        {/* Row 1: Player + market/model */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-white truncate leading-tight">
              {pick.player_name}
            </h3>
            <p className="text-xs text-white/30 mt-0.5">
              {pick.opponent_team ? `vs ${pick.opponent_team}` : ""}
              {pick.is_home != null && (
                <span className="text-white/15 ml-1">{pick.is_home ? "(H)" : "(A)"}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {tier && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border}`}>
                {tier === "star_tier" ? "STAR" : tier}
              </span>
            )}
            {model && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white/30 bg-white/[0.04]">
                {model}
              </span>
            )}
          </div>
        </div>

        {/* Prediction line */}
        <div className="flex items-baseline gap-2.5 mt-3">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
              isOver
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {isOver ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {pick.prediction}
          </span>
          {line != null && line > 0 && (
            <span className="text-xl font-bold text-white tabular-nums">{line}</span>
          )}
          <span className="text-xs font-medium text-white/25">{market}</span>
        </div>

        {book && (
          <p className="text-[11px] text-white/20 mt-1.5">{book}</p>
        )}
      </div>

      {/* Stats row */}
      {(edge != null || edgePct != null || pick.p_over != null) && (
        <div className="flex items-center gap-5 px-5 py-3 border-t border-white/[0.04]">
          {edge != null && (
            <div>
              <p className="text-[10px] text-white/25 mb-0.5">Edge</p>
              <p className={`text-sm font-semibold tabular-nums ${
                edge >= 3 ? "text-emerald-400" : edge >= 1.5 ? "text-amber-400" : "text-white/50"
              }`}>
                {edge > 0 ? "+" : ""}{typeof edge === "number" ? edge.toFixed(1) : edge}
              </p>
            </div>
          )}
          {edgePct != null && (
            <div>
              <p className="text-[10px] text-white/25 mb-0.5">Edge %</p>
              <p className={`text-sm font-semibold tabular-nums ${
                edgePct >= 20 ? "text-emerald-400" : edgePct >= 10 ? "text-amber-400" : "text-white/50"
              }`}>
                {typeof edgePct === "number" ? edgePct.toFixed(1) : edgePct}%
              </p>
            </div>
          )}
          {pick.p_over != null && (
            <div>
              <p className="text-[10px] text-white/25 mb-0.5">Prob</p>
              <p className="text-sm font-semibold tabular-nums text-white/60">
                {(pick.p_over * 100).toFixed(0)}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* Progress + result */}
      <div className="px-5 pb-4 pt-1">
        {actual != null && line != null && line > 0 && (
          <div className="mb-3">
            <ProgressBar actual={actual} line={line} isHit={pick.is_hit} prediction={pick.prediction} />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-white/20">Progress</span>
              <span className="text-sm font-semibold text-white tabular-nums">
                {actual}
                <span className="text-white/20 text-xs ml-0.5">/ {line}</span>
              </span>
            </div>
          </div>
        )}

        {/* Status */}
        {pick.is_hit === true ? (
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">Hit</span>
          </div>
        ) : pick.is_hit === false ? (
          <div className="flex items-center gap-1.5 text-red-400">
            <X className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">Miss</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-white/25">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Pending</span>
          </div>
        )}
      </div>
    </div>
  );
}
