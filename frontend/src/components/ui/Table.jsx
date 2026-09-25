import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import clsx from 'clsx';

/**
 * Table - Data table component with sorting and selection
 *
 * @param {Object} props
 * @param {Array} props.columns - Array: { key, label, sortable, render, width, align }
 * @param {Array} props.data - Array of row objects
 * @param {function} props.onSort - Callback: (column, direction) => {}
 * @param {function} props.onRowClick - Callback: (row) => {}
 * @param {boolean} props.selectable - Enable row selection checkboxes
 * @param {function} props.onSelectionChange - Callback: (selectedRows) => {}
 * @param {boolean} props.loading - Show skeleton loading state
 * @param {React.ReactNode} props.emptyState - Custom empty state component
 * @param {boolean} props.striped - Enable striped rows (default: true)
 * @param {string} props.className - Additional classes
 *
 * @example
 * <Table
 *   columns={[
 *     { key: 'name', label: 'Name', sortable: true },
 *     { key: 'status', label: 'Status', render: (row) => <Badge>{row.status}</Badge> },
 *     { key: 'actions', label: 'Actions', render: (row) => <button>Edit</button> }
 *   ]}
 *   data={projects}
 *   onSort={(column, direction) => sortData(column, direction)}
 *   loading={isLoading}
 *   selectable
 * />
 */
const Table = ({
  columns = [],
  data = [],
  onSort,
  onRowClick,
  selectable = false,
  onSelectionChange,
  loading = false,
  emptyState,
  striped = true,
  className = '',
}) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Handle column sort
  const handleSort = (column) => {
    if (!column.sortable) return;

    let direction = 'asc';
    if (sortConfig.key === column.key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfig.direction === 'desc') {
        direction = null;
      }
    }

    const newConfig = {
      key: direction ? column.key : null,
      direction,
    };

    setSortConfig(newConfig);
    onSort?.(column.key, direction);
  };

  // Handle select all
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = new Set(data.map((_, index) => index));
      setSelectedRows(allIds);
      onSelectionChange?.(data);
    } else {
      setSelectedRows(new Set());
      onSelectionChange?.([]);
    }
  };

  // Handle select row
  const handleSelectRow = (index, row) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRows(newSelected);
    onSelectionChange?.(data.filter((_, i) => newSelected.has(i)));
  };

  // Check if all rows are selected
  const isAllSelected = data.length > 0 && selectedRows.size === data.length;
  const isSomeSelected = selectedRows.size > 0 && selectedRows.size < data.length;

  // Get sort icon
  const getSortIcon = (column) => {
    if (!column.sortable) return null;

    if (sortConfig.key === column.key) {
      if (sortConfig.direction === 'asc') {
        return <ArrowUp className="w-4 h-4" />;
      } else if (sortConfig.direction === 'desc') {
        return <ArrowDown className="w-4 h-4" />;
      }
    }

    return <Minus className="w-4 h-4 opacity-30" />;
  };

  // Skeleton loader
  const SkeletonRow = () => (
    <tr className="animate-pulse">
      {selectable && (
        <td className="px-6 py-4">
          <div className="w-4 h-4 bg-surface-2 rounded-sm" />
        </td>
      )}
      {columns.map((column) => (
        <td key={column.key} className="px-6 py-4">
          <div className="h-4 bg-surface-2 rounded-sm w-3/4" />
        </td>
      ))}
    </tr>
  );

  // Default empty state
  const DefaultEmptyState = () => (
    <tr>
      <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-6 py-12 text-center text-text-2">
        <div className="flex flex-col items-center gap-2">
          <svg className="w-12 h-12 text-text-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="t-body font-medium text-text-1">No data available</p>
          <p className="t-small text-text-2">Get started by adding your first item.</p>
        </div>
      </td>
    </tr>
  );

  // Alignment classes
  const getAlignClass = (align) => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  };

  return (
    <div className={clsx('overflow-x-auto rounded-lg border border-border', className)}>
      <table className="w-full t-small text-left text-text-2">
        {/* Table Header */}
        <thead className="t-label bg-surface-2 border-b border-border">
          <tr>
            {/* Select all checkbox */}
            {selectable && (
              <th scope="col" className="px-6 py-4 w-12">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => el && (el.indeterminate = isSomeSelected)}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded-sm border-border bg-surface-2 text-accent focus-visible:outline-2 outline-accent"
                    aria-label="Select all rows"
                  />
                </div>
              </th>
            )}

            {/* Column headers */}
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={clsx(
                  'px-6 py-4 text-text-3',
                  column.sortable && 'cursor-pointer select-none hover:text-text-2',
                  getAlignClass(column.align)
                )}
                style={{ width: column.width }}
                onClick={() => handleSort(column)}
              >
                <div className="flex items-center gap-2">
                  <span>{column.label}</span>
                  {column.sortable && getSortIcon(column)}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {loading ? (
            // Loading skeleton
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          ) : data.length === 0 ? (
            // Empty state
            emptyState || <DefaultEmptyState />
          ) : (
            // Data rows
            data.map((row, rowIndex) => {
              const isSelected = selectedRows.has(rowIndex);
              const isClickable = !!onRowClick;

              return (
                <tr
                  key={row.id || rowIndex}
                  className={clsx(
                    'border-b border-border transition-colors',
                    striped && rowIndex % 2 === 1 ? 'bg-surface-1' : 'bg-transparent',
                    isSelected && 'bg-accent/10',
                    isClickable && 'cursor-pointer hover:bg-surface-2'
                  )}
                  onClick={isClickable ? () => onRowClick(row) : undefined}
                >
                  {/* Selection checkbox */}
                  {selectable && (
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(rowIndex, row)}
                          className="w-4 h-4 rounded-sm border-border bg-surface-2 text-accent focus-visible:outline-2 outline-accent"
                          aria-label={`Select row ${rowIndex + 1}`}
                        />
                      </div>
                    </td>
                  )}

                  {/* Data cells */}
                  {columns.map((column) => (
                    <td key={column.key} className={clsx('px-6 py-4', getAlignClass(column.align))}>
                      {column.render ? column.render(row, rowIndex) : row[column.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
