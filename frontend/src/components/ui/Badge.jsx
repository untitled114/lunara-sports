import clsx from 'clsx'

const V = {
  neutral: 'text-text-2 bg-surface-2',
  accent: 'text-accent bg-accent/10',
  live: 'text-live bg-live/10',
  win: 'text-live bg-live/10',
  loss: 'text-loss bg-loss/10',
  warn: 'text-warn bg-warn/10',
}

export function Badge({
  variant = 'neutral',
  dot = false,
  pulse = false,
  className,
  children,
  ...rest
}) {
  return (
    <span
      className={clsx(
        't-label inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-2 py-0.5',
        V[variant] ?? V.neutral,
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
          <span aria-hidden className="h-1.5 w-1.5 rounded-sm bg-current" />
        ))}
      {children}
    </span>
  )
}
export default Badge
