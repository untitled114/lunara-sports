import React from 'react';

/**
 * Badge Component
 *
 * Versatile badge/pill component for status indicators, labels, and tags.
 *
 * @param {string} variant - Color variant: primary, success, warning, danger, info, gray
 * @param {string} size - Size: sm, md, lg
 * @param {boolean} dot - Show colored dot indicator
 * @param {boolean} removable - Show remove button
 * @param {function} onRemove - Callback when remove button is clicked
 * @param {string} className - Additional CSS classes
 * @param {ReactNode} children - Badge content
 *
 * Usage:
 * <Badge variant="success">Active</Badge>
 * <Badge variant="warning" dot>Pending</Badge>
 * <Badge variant="danger" size="sm" removable onRemove={() => {}}>Error</Badge>
 */
const Badge = ({
  variant = 'gray',
  size = 'md',
  dot = false,
  removable = false,
  onRemove,
  className = '',
  children,
  ...props
}) => {
  // Variant styles
  const variantStyles = {
    primary: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    danger: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
    dark: 'bg-gray-800 text-gray-200 border-gray-700',
  };

  // Dark mode variants (for dark backgrounds)
  const darkVariantStyles = {
    primary: 'bg-indigo-900/30 text-indigo-300 border-indigo-500/30',
    success: 'bg-green-900/30 text-green-300 border-green-500/30',
    warning: 'bg-yellow-900/30 text-yellow-300 border-yellow-500/30',
    danger: 'bg-red-900/30 text-red-300 border-red-500/30',
    info: 'bg-blue-900/30 text-blue-300 border-blue-500/30',
    gray: 'bg-gray-700/50 text-gray-300 border-gray-600/50',
    dark: 'bg-gray-800 text-gray-200 border-gray-700',
  };

  // Size styles
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-sm',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  // Dot colors
  const dotColors = {
    primary: 'bg-indigo-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500',
    gray: 'bg-gray-500',
    dark: 'bg-gray-400',
  };

  // Use dark variants by default as PbP is a dark-themed app
  const styles = darkVariantStyles[variant] || darkVariantStyles.gray;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        font-medium rounded-full border
        ${styles}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {/* Dot Indicator */}
      {dot && (
        <span className={`w-2 h-2 rounded-full ${dotColors[variant]}`} />
      )}

      {/* Content */}
      <span>{children}</span>

      {/* Remove Button */}
      {removable && onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 hover:opacity-70 transition-opacity focus:outline-none"
          aria-label="Remove"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </span>
  );
};

export default Badge;
