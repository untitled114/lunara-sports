import clsx from 'clsx'

export function Card({ live = false, as: Tag = 'div', className, children, ...rest }) {
  return (
    <Tag
      className={clsx(
        'bg-surface-card border border-border rounded-lg p-4 transition-colors hover:border-border-strong',
        live && 'card-live',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}
