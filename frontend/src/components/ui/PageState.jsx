export function PageState({ kind, title, message, onRetry, action }) {
  if (kind === 'loading') {
    return (
      <div role="status" aria-busy="true" aria-label="Loading" className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-surface-1 animate-pulse" />
        ))}
      </div>
    )
  }
  const heading = title ?? (kind === 'error' ? "Couldn't load this." : 'Nothing here yet.')
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-1 px-6 py-10 text-center">
      <p className="t-section text-text-1">{heading}</p>
      {message && <p className="t-small text-text-2 max-w-sm">{message}</p>}
      {kind === 'error' && onRetry && (
        <button
          onClick={onRetry}
          className="t-small rounded-md bg-accent px-4 py-2 text-white hover:bg-accent-hover"
        >
          Try again
        </button>
      )}
      {action}
    </div>
  )
}
