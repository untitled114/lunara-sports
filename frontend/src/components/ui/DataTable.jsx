import clsx from 'clsx'

export function DataTable({ columns, rows, getKey, className }) {
  return (
    <div className={clsx('overflow-x-auto rounded-lg border border-border', className)}>
      <table className="w-full t-small">
        <thead className="sticky top-0 bg-surface-2">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={clsx(
                  't-label text-text-3 px-3 py-2',
                  c.numeric || c.align === 'right' ? 'text-right' : 'text-left'
                )}
              >
                {c.label}
              </th>
            ))}
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
