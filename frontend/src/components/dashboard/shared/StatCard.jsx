import React from 'react';
import PropTypes from 'prop-types';

/**
 * StatCard - Reusable statistics display card with icon, title, value, and change indicator
 *
 * @param {string} title - The stat title/label
 * @param {string|number} value - The main stat value to display
 * @param {string} [change] - Optional change indicator (e.g., "+12.5%")
 * @param {React.ReactNode} [icon] - Optional icon element
 * @param {string} [emoji] - Optional emoji (alternative to icon)
 * @param {string} [color] - Color scheme: 'indigo'|'green'|'yellow'|'red'|'purple'|'emerald'
 * @param {string} [description] - Optional description text below value
 * @param {boolean} [loading] - Loading state
 */
const StatCard = ({
  title,
  value,
  change,
  icon,
  emoji,
  color = 'indigo',
  description,
  loading = false,
}) => {
  const colorClasses = {
    indigo: 'border-indigo-500/20 hover:shadow-indigo-500/20 hover:border-indigo-500/50 from-indigo-600 to-indigo-400',
    green: 'border-green-500/20 hover:shadow-green-500/20 hover:border-green-500/50 from-green-600 to-green-400',
    yellow: 'border-yellow-500/20 hover:shadow-yellow-500/20 hover:border-yellow-500/50 from-yellow-600 to-yellow-400',
    red: 'border-red-500/20 hover:shadow-red-500/20 hover:border-red-500/50 from-red-600 to-red-400',
    purple: 'border-purple-500/20 hover:shadow-purple-500/20 hover:border-purple-500/50 from-purple-600 to-purple-400',
    emerald: 'border-emerald-500/20 hover:shadow-emerald-500/20 hover:border-emerald-500/50 from-emerald-600 to-emerald-400',
  };

  const classes = colorClasses[color] || colorClasses.indigo;

  if (loading) {
    return (
      <div className={`group relative bg-gray-800/50 backdrop-blur-sm border ${classes.split(' ')[0]} rounded-2xl shadow-lg p-4 sm:p-6`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/2 mb-3"></div>
          <div className="h-8 bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-700 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative bg-gray-800/50 backdrop-blur-sm border ${classes} rounded-2xl shadow-lg hover:shadow-2xl hover:transform hover:-translate-y-2 transition-all duration-300 p-4 sm:p-6`}
    >
      {/* Top Accent Line */}
      <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r ${classes.split('from-')[1]} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {emoji && <span className="text-2xl sm:text-3xl">{emoji}</span>}
            {icon && <div className="text-gray-400">{icon}</div>}
          </div>
          <div className="text-sm sm:text-sm text-gray-400 mb-1">{title}</div>
          <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{value}</div>
          {(description || change) && (
            <div className="text-sm text-gray-400">
              {description || change}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  change: PropTypes.string,
  icon: PropTypes.node,
  emoji: PropTypes.string,
  color: PropTypes.oneOf(['indigo', 'green', 'yellow', 'red', 'purple', 'emerald']),
  description: PropTypes.string,
  loading: PropTypes.bool,
};

export default StatCard;
