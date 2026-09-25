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

export function Badge({ variant = 'neutral', className, children, ...rest }) {
  const resolved = LEGACY_VARIANT_ALIAS[variant] ?? variant
  return (
    <span
      className={clsx(
        't-label inline-flex items-center rounded-sm px-2 py-0.5',
        V[resolved] ?? V.neutral,
        className
      )}
      {...rest}
    >
      {children}
    </span>
  )
}
export default Badge
