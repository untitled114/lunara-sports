import clsx from 'clsx'

export function Segmented({ options, value, onChange, className }) {
  return (
    <div
      role="tablist"
      className={clsx('inline-flex gap-1 rounded-md bg-surface-1 border border-border p-1', className)}
    >
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={clsx(
            't-small rounded-md px-3 py-1.5 transition-colors focus-visible:outline-2 outline-accent',
            value === o.id ? 'bg-surface-2 text-text-1' : 'text-text-2 hover:text-text-1'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
