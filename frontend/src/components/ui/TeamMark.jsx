const SIZES = { sm: 'h-6 w-6', md: 'h-9 w-9', lg: 'h-14 w-14' }

export function TeamMark({ abbrev, logoUrl, size = 'md' }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2">
      {logoUrl ? (
        <img src={logoUrl} alt={`${abbrev} logo`} className={`${SIZES[size]} object-contain`} loading="lazy" />
      ) : null}
      <span className="t-section text-text-1">{abbrev}</span>
    </span>
  )
}
