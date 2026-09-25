import clsx from 'clsx'

const V = {
  neutral: 'text-text-2 bg-surface-2',
  accent: 'text-accent bg-accent/10',
  live: 'text-live bg-live/10',
  win: 'text-live bg-live/10',
  loss: 'text-loss bg-loss/10',
  warn: 'text-warn bg-warn/10',
}

// Legacy variant names from the pre-redesign Badge API (variant: primary|success|warning|
// danger|info|gray|dark). Consumers that still pass these (Leaderboard, PickTracker,
// BetTracker, PlayerProfilePage, GameDetailPage) are rollout tasks for later; this table
// keeps them rendering on the new token-only variants without editing those pages here.
// TODO(Task 14): remove this alias table once every consumer passes a current variant name.
const LEGACY_VARIANT_ALIAS = {
  primary: 'accent',
  info: 'accent',
  success: 'win',
  warning: 'warn',
  danger: 'loss',
  gray: 'neutral',
  dark: 'neutral',
}

export function Badge({
  variant = 'neutral',
  dot = false,
  pulse = false,
  // Legacy props from the pre-redesign API. Destructured (not spread) purely to drop
  // them here so they never leak onto the DOM node as unknown attributes/handlers.
  // TODO(Task 14): delete once every consumer drops these too.
  size: _legacySize,
  removable: _legacyRemovable,
  onRemove: _legacyOnRemove,
  className,
  children,
  ...rest
}) {
  const resolved = LEGACY_VARIANT_ALIAS[variant] ?? variant
  return (
    <span
      className={clsx(
        't-label inline-flex items-center gap-1 rounded-sm px-2 py-0.5',
        V[resolved] ?? V.neutral,
        className
      )}
      {...rest}
    >
      {dot &&
        (pulse ? (
          <span aria-hidden className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-sm bg-current opacity-75 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-sm bg-current" />
          </span>
        ) : (
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        ))}
      {children}
    </span>
  )
}
export default Badge
