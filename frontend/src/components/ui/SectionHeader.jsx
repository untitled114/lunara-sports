export function SectionHeader({ title, aside }) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-3">
      <h2 className="t-section text-text-1">{title}</h2>
      {aside ? (typeof aside === 'string' ? <span className="t-label text-text-3 text-right">{aside}</span> : aside) : null}
    </div>
  )
}
