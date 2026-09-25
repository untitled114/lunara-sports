import clsx from 'clsx'
import { useRef } from 'react'

// APG tabs pattern (automatic activation): roving tabindex — only the selected tab is
// tabbable (tabIndex 0), the rest are tabIndex -1 — and ArrowLeft/ArrowRight/Home/End
// both move focus and select in one step.
export function Segmented({ options, value, onChange, className }) {
  const tabRefs = useRef([])

  const selectByIndex = (index) => {
    const wrapped = (index + options.length) % options.length
    const next = options[wrapped]
    onChange(next.id)
    tabRefs.current[wrapped]?.focus()
  }

  const handleKeyDown = (event, index) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        selectByIndex(index + 1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        selectByIndex(index - 1)
        break
      case 'Home':
        event.preventDefault()
        selectByIndex(0)
        break
      case 'End':
        event.preventDefault()
        selectByIndex(options.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div
      role="tablist"
      className={clsx(
        // Same overflow behaviour as Tabs: never wider than its container; scrolls sideways
        // with no visible scrollbar when the options don't fit.
        'inline-flex max-w-full gap-1 rounded-md bg-surface-1 border border-border p-1 overflow-x-auto scrollbar-hide',
        className
      )}
    >
      {options.map((o, index) => {
        const selected = value === o.id
        return (
          <button
            key={o.id}
            ref={(el) => {
              tabRefs.current[index] = el
            }}
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={clsx(
              't-small shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 transition-colors focus-visible:outline-2 outline-accent',
              selected ? 'bg-surface-2 text-text-1' : 'text-text-2 hover:text-text-1'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
