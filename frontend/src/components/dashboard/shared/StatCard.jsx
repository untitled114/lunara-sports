import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';

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
// `color` keeps its historical prop values for backward compatibility; every
// value maps onto one of the four design tokens (accent/live/warn/loss).
const COLOR_TOKEN = {
  indigo: 'border-accent/30',
  green: 'border-live/30',
  yellow: 'border-warn/30',
  red: 'border-loss/30',
  purple: 'border-accent/30',
  emerald: 'border-live/30',
};

const StatCard = ({ title, value, change, icon, emoji, color = 'indigo', description, loading = false }) => {
  const borderClass = COLOR_TOKEN[color] || COLOR_TOKEN.indigo;

  if (loading) {
    return (
      <div className={clsx('bg-surface-1 border rounded-lg p-4 sm:p-6', borderClass)}>
        <div className="animate-pulse">
          <div className="h-4 bg-surface-2 rounded-sm w-1/2 mb-3" />
          <div className="h-8 bg-surface-2 rounded-sm w-3/4 mb-2" />
          <div className="h-3 bg-surface-2 rounded-sm w-1/3" />
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('bg-surface-1 border rounded-lg p-4 sm:p-6 transition-all duration-300 hover:-translate-y-2', borderClass)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {emoji && <span className="text-2xl sm:text-3xl">{emoji}</span>}
            {icon && <div className="text-text-3">{icon}</div>}
          </div>
          <div className="t-small text-text-2 mb-1">{title}</div>
          <div className="t-title tnum text-text-1 mb-1">{value}</div>
          {(description || change) && <div className="t-small text-text-2">{description || change}</div>}
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
