import React from 'react';
import clsx from 'clsx';

/**
 * Skeleton Component
 *
 * Loading placeholder with pulse animation.
 * Use while data is loading to improve perceived performance.
 *
 * @param {string} variant - Shape: text, circle, rectangle, card
 * @param {string} width - Width (CSS value or Tailwind class)
 * @param {string} height - Height (CSS value or Tailwind class)
 * @param {number} count - Number of repeated skeletons (for text lines)
 * @param {string} className - Additional CSS classes
 *
 * Usage:
 * <Skeleton variant="text" count={3} />
 * <Skeleton variant="circle" width="w-12" height="h-12" />
 * <Skeleton variant="rectangle" width="w-full" height="h-32" />
 */
const Skeleton = ({ variant = 'text', width, height, count = 1, className = '' }) => {
  // Base skeleton styles
  const baseStyles = 'animate-pulse bg-surface-2 rounded-sm';

  // Variant-specific styles (avatars/badges render as soft-rounded blocks, not circles,
  // consistent with TeamMark rendering logos unmasked elsewhere in the app)
  const variantStyles = {
    text: clsx('h-4', width || 'w-full'),
    circle: clsx('rounded-lg', width || 'w-12', height || 'h-12'),
    rectangle: clsx(width || 'w-full', height || 'h-32'),
    card: clsx(width || 'w-full', height || 'h-48', 'rounded-lg'),
  };

  // For multiple text lines
  if (count > 1 && variant === 'text') {
    return (
      <div className={clsx('space-y-3', className)}>
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={clsx(baseStyles, variantStyles[variant])}
            style={{
              width: index === count - 1 ? '80%' : '100%', // Last line is shorter
            }}
          />
        ))}
      </div>
    );
  }

  return <div className={clsx(baseStyles, variantStyles[variant], className)} />;
};

// Common skeleton presets
Skeleton.Avatar = ({ size = 'w-12 h-12', className = '' }) => (
  <Skeleton variant="circle" width={size} height={size} className={className} />
);

Skeleton.Text = ({ lines = 1, className = '' }) => <Skeleton variant="text" count={lines} className={className} />;

Skeleton.Title = ({ className = '' }) => <Skeleton variant="text" width="w-48" height="h-6" className={className} />;

Skeleton.Button = ({ className = '' }) => (
  <Skeleton variant="rectangle" width="w-24" height="h-10" className={clsx('rounded-md', className)} />
);

Skeleton.Card = ({ className = '' }) => (
  <div className={clsx('rounded-lg border border-border bg-surface-card p-6', className)}>
    <div className="flex items-center gap-4 mb-4">
      <Skeleton.Avatar />
      <div className="flex-1">
        <Skeleton.Title />
        <Skeleton variant="text" width="w-32" className="mt-2" />
      </div>
    </div>
    <Skeleton.Text lines={3} />
    <div className="flex gap-2 mt-4">
      <Skeleton.Button />
      <Skeleton.Button />
    </div>
  </div>
);

Skeleton.Table = ({ rows = 5, columns = 4, className = '' }) => (
  <div className={clsx('space-y-3', className)}>
    {/* Header */}
    <div className="flex gap-4">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={`header-${i}`} variant="text" width="flex-1" height="h-4" />
      ))}
    </div>

    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={`row-${rowIndex}`} className="flex gap-4">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={`cell-${rowIndex}-${colIndex}`} variant="text" width="flex-1" height="h-4" />
        ))}
      </div>
    ))}
  </div>
);

Skeleton.List = ({ items = 5, className = '' }) => (
  <div className={clsx('space-y-4', className)}>
    {Array.from({ length: items }).map((_, index) => (
      <div key={index} className="flex items-center gap-4">
        <Skeleton.Avatar size="w-10 h-10" />
        <div className="flex-1">
          <Skeleton variant="text" width="w-3/4" height="h-4" />
          <Skeleton variant="text" width="w-1/2" height="h-3" className="mt-2" />
        </div>
      </div>
    ))}
  </div>
);

Skeleton.Dashboard = ({ className = '' }) => (
  <div className={clsx('space-y-6', className)}>
    {/* Stats Grid */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg bg-surface-card p-6">
          <Skeleton variant="text" width="w-24" height="h-4" />
          <Skeleton variant="text" width="w-16" height="h-8" className="mt-2" />
        </div>
      ))}
    </div>

    {/* Content Cards */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Skeleton.Card />
      <Skeleton.Card />
    </div>
  </div>
);

export default Skeleton;
