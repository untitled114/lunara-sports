import { TrendingUp, TrendingDown, Check, X, Clock } from 'lucide-react';
import clsx from 'clsx';
import { Badge } from '@/components/ui';

const MARKET_LABEL = {
  POINTS: 'PTS',
  REBOUNDS: 'REB',
  ASSISTS: 'AST',
  THREES: '3PT',
  STEALS: 'STL',
  BLOCKS: 'BLK',
};

const TIER_VARIANT = {
  X: 'warn',
  Z: 'accent',
  META: 'live',
  Goldmine: 'warn',
  star_tier: 'accent',
  A: 'neutral',
};

function formatBook(book) {
  if (!book) return null;
  return book.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function ProgressBar({ actual, line, isHit, prediction }) {
  if (actual == null || line == null || line === 0) return null;

  const pct = Math.min(Math.round((actual / line) * 100), 150);
  const isOver = prediction?.toUpperCase() === 'OVER';

  let colorVar;
  if (isHit === true) colorVar = 'var(--live)';
  else if (isHit === false) colorVar = 'var(--loss)';
  else if ((isOver && actual >= line) || (!isOver && actual <= line)) colorVar = 'var(--live)';
  else colorVar = 'var(--accent)';

  return (
    <div className="h-1 rounded-sm bg-surface-2 overflow-hidden">
      <div
        className="h-full rounded-sm transition-all duration-700 ease-out"
        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: colorVar }}
      />
    </div>
  );
}

export function PickCard({ pick, delay = 0 }) {
  const actual = pick.actual_value;
  const line = pick.line;
  const isOver = pick.prediction?.toUpperCase() === 'OVER';
  const edge = pick.edge;
  const edgePct = pick.edge_pct;
  const tier = pick.tier;
  const tierVariant = TIER_VARIANT[tier] || TIER_VARIANT.A;
  const market = MARKET_LABEL[pick.market] || pick.market;
  const model = pick.model_version?.toUpperCase();
  const book = formatBook(pick.book);

  return (
    <div
      className="rounded-lg border border-border bg-surface-1 overflow-hidden animate-fadeIn transition-all duration-300 hover:border-border-strong group relative"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Top section */}
      <div className="p-5 pb-4">
        {/* Row 1: Player + market/model */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <h3 className="t-body font-semibold text-text-1 truncate leading-tight">{pick.player_name}</h3>
            <p className="t-small text-text-3 mt-0.5">
              {pick.opponent_team ? `vs ${pick.opponent_team}` : ''}
              {pick.is_home != null && <span className="text-text-3 ml-1">{pick.is_home ? '(H)' : '(A)'}</span>}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {tier && <Badge variant={tierVariant}>{tier === 'star_tier' ? 'STAR' : tier}</Badge>}
            {model && <Badge variant="neutral">{model}</Badge>}
          </div>
        </div>

        {/* Prediction line */}
        <div className="flex items-baseline gap-2.5 mt-3">
          <Badge variant={isOver ? 'win' : 'loss'}>
            {isOver ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {pick.prediction}
          </Badge>
          {line != null && line > 0 && <span className="text-xl font-semibold tnum text-text-1">{line}</span>}
          <span className="t-label text-text-3">{market}</span>
        </div>

        {book && <p className="t-small text-text-3 mt-1.5">{book}</p>}
      </div>

      {/* Stats row */}
      {(edge != null || edgePct != null || pick.p_over != null) && (
        <div className="flex items-center gap-5 px-5 py-3 border-t border-border">
          {edge != null && (
            <div>
              <p className="t-label text-text-3 mb-0.5">Edge</p>
              <p className={clsx('t-small tnum font-semibold', edge >= 3 ? 'text-live' : edge >= 1.5 ? 'text-warn' : 'text-text-2')}>
                {edge > 0 ? '+' : ''}
                {typeof edge === 'number' ? edge.toFixed(1) : edge}
              </p>
            </div>
          )}
          {edgePct != null && (
            <div>
              <p className="t-label text-text-3 mb-0.5">Edge %</p>
              <p
                className={clsx(
                  't-small tnum font-semibold',
                  edgePct >= 20 ? 'text-live' : edgePct >= 10 ? 'text-warn' : 'text-text-2'
                )}
              >
                {typeof edgePct === 'number' ? edgePct.toFixed(1) : edgePct}%
              </p>
            </div>
          )}
          {pick.p_over != null && (
            <div>
              <p className="t-label text-text-3 mb-0.5">Prob</p>
              <p className="t-small tnum font-semibold text-text-2">{(pick.p_over * 100).toFixed(0)}%</p>
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
              <span className="t-label text-text-3">Progress</span>
              <span className="t-small tnum font-semibold text-text-1">
                {actual}
                <span className="text-text-3 t-small ml-0.5">/ {line}</span>
              </span>
            </div>
          </div>
        )}

        {/* Status */}
        {pick.is_hit === true ? (
          <div className="flex items-center gap-1.5 text-live">
            <Check className="h-3.5 w-3.5" />
            <span className="t-small font-semibold">Hit</span>
          </div>
        ) : pick.is_hit === false ? (
          <div className="flex items-center gap-1.5 text-loss">
            <X className="h-3.5 w-3.5" />
            <span className="t-small font-semibold">Miss</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-text-3">
            <Clock className="h-3.5 w-3.5" />
            <span className="t-small font-medium">Pending</span>
          </div>
        )}
      </div>
    </div>
  );
}
