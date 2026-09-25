import clsx from 'clsx'

// `sort` / `onSortChange` are optional and controlled: DataTable never sorts `rows`
// itself (the caller owns ordering), it only reflects `sort` in the header UI
// (aria-sort + ▲/▼) and reports clicks via `onSortChange(columnKey)`. Columns without
// `sortable: true` render exactly as before (plain header text, no button, no
// aria-sort) — passing `sort`/`onSortChange` alone changes nothing for them.
export function DataTable({ columns, rows, getKey, className, sort, onSortChange }) {
  return (
    <div className={clsx('overflow-x-auto rounded-lg border border-border', className)}>
      <table className="w-full t-small">
        <thead className="bg-surface-2">
          <tr>
            {columns.map((c) => {
              const isActive = sort && sort.key === c.key
              const ariaSort = c.sortable ? (isActive ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none') : undefined
              const alignRight = c.numeric || c.align === 'right'
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={clsx('t-label text-text-3 px-3 py-2', alignRight ? 'text-right' : 'text-left')}
                >
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => onSortChange && onSortChange(c.key)}
                      className={clsx(
                        't-label inline-flex items-center gap-1 text-text-3 hover:text-text-1 focus-visible:outline-2 outline-accent',
                        alignRight && 'flex-row-reverse'
                      )}
                    >
                      {c.label}
                      {isActive && <span aria-hidden="true">{sort.dir === 'desc' ? '▼' : '▲'}</span>}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={getKey(r)} className="border-t border-border">
              {columns.map((c) => (
                <td key={c.key} className={clsx('px-3 py-2 text-text-1', c.numeric && 'tnum text-right')}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
