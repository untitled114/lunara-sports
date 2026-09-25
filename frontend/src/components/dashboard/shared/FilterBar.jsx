import React from 'react';
import PropTypes from 'prop-types';
import { Search, Calendar } from 'lucide-react';
import clsx from 'clsx';

/**
 * FilterBar - Reusable filter controls for search, date range, and status filtering
 *
 * @param {string} [searchQuery] - Current search query value
 * @param {function} [onSearchChange] - Search change handler
 * @param {string} [searchPlaceholder] - Search input placeholder
 * @param {Array} [filters] - Array of filter objects: { label, value, active, onClick }
 * @param {string} [activeFilter] - Currently active filter value
 * @param {function} [onFilterChange] - Filter change handler
 * @param {boolean} [showDateRange] - Show date range picker
 * @param {string} [dateFrom] - Start date value
 * @param {string} [dateTo] - End date value
 * @param {function} [onDateChange] - Date change handler
 */
const FilterBar = ({
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  activeFilter,
  onFilterChange,
  showDateRange = false,
  dateFrom,
  dateTo,
  onDateChange,
}) => {
  return (
    <div className="space-y-4">
      {/* Search and Date Range */}
      {(onSearchChange || showDateRange) && (
        <div className="bg-surface-1 border border-border rounded-lg p-3 sm:p-4 transition-all duration-300 hover:-translate-y-2 hover:border-border-strong">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            {onSearchChange && (
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="t-body w-full pl-10 pr-4 py-2 sm:py-2.5 bg-surface-2 border border-border rounded-md text-text-1 placeholder-text-3 focus-visible:outline-2 outline-accent transition-colors"
                  aria-label="Search"
                />
              </div>
            )}

            {showDateRange && (
              <>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => onDateChange && onDateChange('from', e.target.value)}
                    className="t-body pl-10 pr-4 py-2 sm:py-2.5 bg-surface-2 border border-border rounded-md text-text-1 focus-visible:outline-2 outline-accent transition-colors"
                    aria-label="Date from"
                  />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => onDateChange && onDateChange('to', e.target.value)}
                    className="t-body pl-10 pr-4 py-2 sm:py-2.5 bg-surface-2 border border-border rounded-md text-text-1 focus-visible:outline-2 outline-accent transition-colors"
                    aria-label="Date to"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Filter Buttons */}
      {filters.length > 0 && (
        <div className="bg-surface-1 border border-border rounded-lg p-3 sm:p-4 flex flex-wrap gap-2 transition-all duration-300 hover:-translate-y-2 hover:border-border-strong">
          {filters.map((filter) => {
            const isActive = activeFilter === filter.value || filter.active;
            return (
              <button
                key={filter.value}
                onClick={() => onFilterChange && onFilterChange(filter.value)}
                className={clsx(
                  't-small px-3 sm:px-4 py-2 rounded-md font-medium transition-colors',
                  isActive ? 'bg-accent-fill text-white' : 'bg-surface-2 text-text-2 border border-border hover:bg-surface-1'
                )}
                aria-label={filter.label}
                aria-pressed={isActive}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

FilterBar.propTypes = {
  searchQuery: PropTypes.string,
  onSearchChange: PropTypes.func,
  searchPlaceholder: PropTypes.string,
  filters: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
      active: PropTypes.bool,
      onClick: PropTypes.func,
    })
  ),
  activeFilter: PropTypes.string,
  onFilterChange: PropTypes.func,
  showDateRange: PropTypes.bool,
  dateFrom: PropTypes.string,
  dateTo: PropTypes.string,
  onDateChange: PropTypes.func,
};

export default FilterBar;
