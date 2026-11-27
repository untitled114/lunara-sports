import clsx from 'clsx'
import { LinkRow } from './LinkRow'

// `sort` / `onSortChange` are optional and controlled: DataTable never sorts `rows`
// itself (the caller owns ordering), it only reflects `sort` in the header UI
// (aria-sort + ▲/▼) and reports clicks via `onSortChange(columnKey)`. Columns without
// `sortable: true` render exactly as before (plain header text, no button, no
// aria-sort) - passing `sort`/`onSortChange` alone changes nothing for them.
// Numeric cells never wrap; a text column whose values must stay on one line (a height
// like 6' 9", an ISO date) sets `nowrap: true`.
// `fullWidthRow(row)` (optional): a row it returns true for is one cell spanning every
// column, rendered with the first column's render (a section label such as "Bench").
function BodyRow({ to, className, children }) {
  const cls = clsx('border-t border-border', className);
  if (to) return <LinkRow to={to} className={cls}>{children}</LinkRow>;
  return <tr className={cls}>{children}</tr>;
}

// `rowLink(row)`: the page a whole row opens, or null for a row that opens nothing.
// A column with `sticky: true` stays pinned at the left while the rest swipes sideways.
const PINNED = 'sticky left-0 z-10'

// `rowClassName(row, index)`: extra classes for a body row. `compact`: tighter cell padding.
export function DataTable({ columns, rows, getKey, className, sort, onSortChange, fullWidthRow, rowLink, rowClassName, compact = false }) {
  const pad = compact ? 'px-2' : 'px-3'
  return (
    // tabIndex 0: a table wider than a phone scrolls sideways, and keyboard users need
    // to be able to focus the scroller to do that (axe scrollable-region-focusable).
    <div tabIndex={0} className={clsx('overflow-x-auto rounded-lg border border-border bg-surface-card', className)}>
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
                  className={clsx('t-label text-text-3 py-2', pad, alignRight ? 'text-right' : 'text-left', c.sticky && [PINNED, 'bg-surface-2'])}
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
          {rows.map((r, i) => fullWidthRow && fullWidthRow(r) ? (
            <tr key={getKey(r)} className="border-t border-border">
              <td colSpan={columns.length} className="px-3 py-2 text-text-1">
                {columns[0].render ? columns[0].render(r) : r[columns[0].key]}
              </td>
            </tr>
          ) : (
            <BodyRow key={getKey(r)} to={rowLink ? rowLink(r) : null} className={rowClassName ? rowClassName(r, i) : undefined}>
              {columns.map((c) => (
                <td key={c.key} className={clsx('py-2 text-text-1', pad, c.numeric && 'tnum text-right', (c.numeric || c.nowrap) && 'whitespace-nowrap', c.sticky && [PINNED, 'bg-surface-card'])}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </BodyRow>
          ))}
        </tbody>
      </table>
    </div>
  )
}
