export function Stat({ label, value, delta }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="t-label text-text-3">{label}</span>
      <span className="t-section tnum text-text-1">{value}</span>
      {delta != null && delta !== 0 && (
        <span className={`t-small tnum ${delta > 0 ? 'text-live' : 'text-loss'}`}>
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
        </span>
      )}
    </div>
  )
}
