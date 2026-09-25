import React from 'react';
import PropTypes from 'prop-types';
import { CheckCircle, Clock, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';

/**
 * StatusBadge - Colored status badges with icons
 *
 * @param {string} status - Status value: 'success'|'pending'|'error'|'warning'|'processing'|'completed'|'active'|'review'|'paused'|'failed'
 * @param {string} [label] - Custom label (defaults to status)
 * @param {string} [size] - Size: 'sm'|'md'|'lg'
 * @param {boolean} [showIcon] - Show status icon
 */
const STATUS_CONFIG = {
  success: { tone: 'bg-live/10 text-live border-live/30', icon: CheckCircle, label: 'Success' },
  completed: { tone: 'bg-accent/10 text-accent border-accent/30', icon: CheckCircle, label: 'Completed' },
  pending: { tone: 'bg-warn/10 text-warn border-warn/30', icon: Clock, label: 'Pending' },
  processing: { tone: 'bg-accent/10 text-accent border-accent/30', icon: Loader2, label: 'Processing' },
  error: { tone: 'bg-loss/10 text-loss border-loss/30', icon: XCircle, label: 'Error' },
  failed: { tone: 'bg-loss/10 text-loss border-loss/30', icon: XCircle, label: 'Failed' },
  warning: { tone: 'bg-warn/10 text-warn border-warn/30', icon: AlertCircle, label: 'Warning' },
  active: { tone: 'bg-live/10 text-live border-live/30', icon: CheckCircle, label: 'Active' },
  review: { tone: 'bg-accent/10 text-accent border-accent/30', icon: AlertCircle, label: 'In review' },
  paused: { tone: 'bg-surface-2 text-text-2 border-border', icon: Clock, label: 'Paused' },
};

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-sm',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

const ICON_SIZES = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const StatusBadge = ({ status, label, size = 'md', showIcon = true }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <span
      className={clsx('t-small inline-flex items-center gap-1.5 rounded-sm font-semibold border', config.tone, SIZE_CLASSES[size])}
      role="status"
      aria-label={`Status: ${label || config.label}`}
    >
      {showIcon && Icon && (
        <Icon className={clsx(ICON_SIZES[size], status === 'processing' && 'animate-spin')} aria-hidden="true" />
      )}
      <span>{label || config.label}</span>
    </span>
  );
};

StatusBadge.propTypes = {
  status: PropTypes.oneOf([
    'success',
    'pending',
    'error',
    'warning',
    'processing',
    'completed',
    'active',
    'review',
    'paused',
    'failed',
  ]).isRequired,
  label: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  showIcon: PropTypes.bool,
};

export default StatusBadge;
