import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

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
  className = ''
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
      direction
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
          <div className="w-4 h-4 bg-gray-700 rounded"></div>
        </td>
      )}
      {columns.map((column) => (
        <td key={column.key} className="px-6 py-4">
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
        </td>
      ))}
    </tr>
  );

  // Default empty state
  const DefaultEmptyState = () => (
    <tr>
      <td
        colSpan={columns.length + (selectable ? 1 : 0)}
        className="px-6 py-12 text-center text-gray-400"
      >
        <div className="flex flex-col items-center gap-2">
          <svg
            className="w-12 h-12 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-lg font-medium">No data available</p>
          <p className="text-sm">Get started by adding your first item</p>
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
    <div className={`overflow-x-auto rounded-lg border border-gray-700 ${className}`}>
      <table className="w-full text-sm text-left text-gray-300">
        {/* Table Header */}
        <thead className="text-sm uppercase bg-gray-800 border-b border-gray-700">
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
                    className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-indigo-600 focus:ring-2 focus:ring-indigo-500"
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
                className={`
                  px-6 py-4 font-semibold text-gray-400 tracking-wider
                  ${column.sortable ? 'cursor-pointer select-none hover:text-gray-200' : ''}
                  ${getAlignClass(column.align)}
                `}
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
                  className={`
                    border-b border-gray-700/50 transition-colors
                    ${striped && rowIndex % 2 === 1 ? 'bg-gray-800/30' : 'bg-gray-800/10'}
                    ${isSelected ? 'bg-indigo-900/20' : ''}
                    ${isClickable ? 'cursor-pointer hover:bg-gray-700/50' : ''}
                  `}
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
                          className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                          aria-label={`Select row ${rowIndex + 1}`}
                        />
                      </div>
                    </td>
                  )}

                  {/* Data cells */}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-6 py-4 ${getAlignClass(column.align)}`}
                    >
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
