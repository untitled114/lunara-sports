import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

/**
 * DataTable - Reusable table with sorting, pagination, and custom actions
 *
 * @param {Array} columns - Column definitions: { key, label, sortable, render }
 * @param {Array} data - Data rows
 * @param {function} [onRowClick] - Row click handler
 * @param {boolean} [loading] - Loading state
 * @param {React.ReactNode} [emptyState] - Custom empty state component
 * @param {boolean} [striped] - Striped row styling
 * @param {boolean} [hoverable] - Hoverable row styling
 */
const DataTable = ({
  columns = [],
  data = [],
  onRowClick,
  loading = false,
  emptyState,
  striped = true,
  hoverable = true,
}) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const handleSort = (column) => {
    if (!column.sortable) return;

    if (sortColumn === column.key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column.key);
      setSortDirection('asc');
    }
  };

  const getSortedData = () => {
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  const sortedData = getSortedData();

  if (loading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg overflow-hidden">
        <div className="animate-pulse p-6">
          <div className="h-10 bg-gray-700 rounded mb-4"></div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-700/50 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return emptyState;
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900/50 border-b border-gray-700">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleSort(column)}
                  className={`px-6 py-4 text-left text-sm font-semibold text-gray-400 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-gray-800/50 select-none' : ''
                  }`}
                  role={column.sortable ? 'button' : undefined}
                  aria-sort={
                    sortColumn === column.key
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <div className="flex items-center gap-2">
                    <span>{column.label}</span>
                    {column.sortable && (
                      <span className="text-gray-500">
                        {sortColumn === column.key ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )
                        ) : (
                          <ChevronsUpDown className="w-4 h-4" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {sortedData.map((row, rowIndex) => (
              <tr
                key={row.id || rowIndex}
                onClick={() => onRowClick && onRowClick(row)}
                className={`transition ${
                  striped && rowIndex % 2 === 0 ? 'bg-gray-800/30' : ''
                } ${hoverable ? 'hover:bg-gray-700/50 cursor-pointer' : ''}`}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-300"
                  >
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

DataTable.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      sortable: PropTypes.bool,
      render: PropTypes.func,
    })
  ).isRequired,
  data: PropTypes.array.isRequired,
  onRowClick: PropTypes.func,
  loading: PropTypes.bool,
  emptyState: PropTypes.node,
  striped: PropTypes.bool,
  hoverable: PropTypes.bool,
};

export default DataTable;
