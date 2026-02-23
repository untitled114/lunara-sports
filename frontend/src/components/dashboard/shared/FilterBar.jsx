import React from 'react';
import PropTypes from 'prop-types';
import { Search, Calendar, Filter } from 'lucide-react';

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
        <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-gray-500/20 hover:border-gray-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-3 sm:p-4">
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-gray-600 to-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            {onSearchChange && (
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-10 pr-4 py-2 sm:py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm sm:text-base placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  aria-label="Search"
                />
              </div>
            )}

            {showDateRange && (
              <>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => onDateChange && onDateChange('from', e.target.value)}
                    className="pl-10 pr-4 py-2 sm:py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    aria-label="Date from"
                  />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => onDateChange && onDateChange('to', e.target.value)}
                    className="pl-10 pr-4 py-2 sm:py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
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
        <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-gray-500/20 hover:border-gray-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-3 sm:p-4 flex flex-wrap gap-2">
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-gray-600 to-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => onFilterChange && onFilterChange(filter.value)}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition ${
                (activeFilter === filter.value) || filter.active
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
              }`}
              aria-label={filter.label}
              aria-pressed={(activeFilter === filter.value) || filter.active}
            >
              {filter.label}
            </button>
          ))}
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
