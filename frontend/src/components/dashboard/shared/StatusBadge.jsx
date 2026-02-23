import React from 'react';
import PropTypes from 'prop-types';
import { CheckCircle, Clock, XCircle, AlertCircle, Loader2 } from 'lucide-react';

/**
 * StatusBadge - Colored status badges with icons
 *
 * @param {string} status - Status value: 'success'|'pending'|'error'|'warning'|'processing'|'completed'|'active'|'review'|'paused'|'failed'
 * @param {string} [label] - Custom label (defaults to status)
 * @param {string} [size] - Size: 'sm'|'md'|'lg'
 * @param {boolean} [showIcon] - Show status icon
 */
const StatusBadge = ({
  status,
  label,
  size = 'md',
  showIcon = true,
}) => {
  const statusConfig = {
    success: {
      color: 'bg-green-100 text-green-800 border-green-200',
      darkColor: 'bg-green-900/30 text-green-400 border-green-500/30',
      icon: CheckCircle,
      label: 'Success',
    },
    completed: {
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      darkColor: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
      icon: CheckCircle,
      label: 'Completed',
    },
    pending: {
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      darkColor: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30',
      icon: Clock,
      label: 'Pending',
    },
    processing: {
      color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      darkColor: 'bg-indigo-900/30 text-indigo-400 border-indigo-500/30',
      icon: Loader2,
      label: 'Processing',
    },
    error: {
      color: 'bg-red-100 text-red-800 border-red-200',
      darkColor: 'bg-red-900/30 text-red-400 border-red-500/30',
      icon: XCircle,
      label: 'Error',
    },
    failed: {
      color: 'bg-red-100 text-red-800 border-red-200',
      darkColor: 'bg-red-900/30 text-red-400 border-red-500/30',
      icon: XCircle,
      label: 'Failed',
    },
    warning: {
      color: 'bg-orange-100 text-orange-800 border-orange-200',
      darkColor: 'bg-orange-900/30 text-orange-400 border-orange-500/30',
      icon: AlertCircle,
      label: 'Warning',
    },
    active: {
      color: 'bg-green-100 text-green-800 border-green-200',
      darkColor: 'bg-green-900/30 text-green-400 border-green-500/30',
      icon: CheckCircle,
      label: 'Active',
    },
    review: {
      color: 'bg-purple-100 text-purple-800 border-purple-200',
      darkColor: 'bg-purple-900/30 text-purple-400 border-purple-500/30',
      icon: AlertCircle,
      label: 'In Review',
    },
    paused: {
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      darkColor: 'bg-gray-700/50 text-gray-300 border-gray-600',
      icon: Clock,
      label: 'Paused',
    },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-sm',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${config.darkColor} ${sizeClasses[size]}`}
      role="status"
      aria-label={`Status: ${label || config.label}`}
    >
      {showIcon && Icon && (
        <Icon
          className={`${iconSizes[size]} ${status === 'processing' ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
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
