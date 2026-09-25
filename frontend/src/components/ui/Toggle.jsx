import React from 'react';
import clsx from 'clsx';

/**
 * Toggle Component
 *
 * Switch/toggle component for boolean settings.
 *
 * @param {boolean} checked - Toggle state
 * @param {function} onChange - Callback: (checked) => {}
 * @param {string} label - Label text
 * @param {string} description - Additional description
 * @param {boolean} disabled - Disable the toggle
 * @param {string} size - Size: sm, md, lg
 * @param {string} className - Additional classes
 *
 * Usage:
 * <Toggle
 *   checked={isEnabled}
 *   onChange={(val) => setIsEnabled(val)}
 *   label="Enable notifications"
 *   description="Receive email notifications for important updates"
 * />
 */
const Toggle = ({ checked = false, onChange, label, description, disabled = false, size = 'md', className = '' }) => {
  const handleChange = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  // Size configurations
  const sizes = {
    sm: { track: 'w-8 h-4', thumb: 'w-3 h-3', translate: 'translate-x-4' },
    md: { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'translate-x-5' },
    lg: { track: 'w-14 h-7', thumb: 'w-6 h-6', translate: 'translate-x-7' },
  };

  const sizeConfig = sizes[size];

  return (
    <div className={clsx('flex items-center justify-between', className)}>
      {/* Label & Description */}
      {(label || description) && (
        <div className="flex-1 mr-4">
          {label && (
            <label
              onClick={!disabled ? handleChange : undefined}
              className={clsx(
                't-small font-medium block',
                disabled ? 'text-text-3 cursor-not-allowed' : 'text-text-1 cursor-pointer'
              )}
            >
              {label}
            </label>
          )}
          {description && <p className="t-small text-text-2 mt-1">{description}</p>}
        </div>
      )}

      {/* Toggle Switch */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={handleChange}
        disabled={disabled}
        className={clsx(
          'relative inline-flex flex-shrink-0 rounded-md transition-colors duration-200 ease-in-out focus-visible:outline-2 outline-accent',
          sizeConfig.track,
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          checked ? 'bg-accent-fill' : 'bg-surface-2'
        )}
      >
        {/* Thumb */}
        <span
          className={clsx(
            'pointer-events-none inline-block rounded-sm bg-text-1 shadow transform ring-0 transition duration-200 ease-in-out',
            sizeConfig.thumb,
            checked ? sizeConfig.translate : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
};

export default Toggle;
