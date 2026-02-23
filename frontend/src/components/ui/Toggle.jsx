import React from 'react';

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
const Toggle = ({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  className = '',
}) => {
  const handleChange = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  // Size configurations
  const sizes = {
    sm: {
      track: 'w-8 h-4',
      thumb: 'w-3 h-3',
      translate: 'translate-x-4',
    },
    md: {
      track: 'w-11 h-6',
      thumb: 'w-5 h-5',
      translate: 'translate-x-5',
    },
    lg: {
      track: 'w-14 h-7',
      thumb: 'w-6 h-6',
      translate: 'translate-x-7',
    },
  };

  const sizeConfig = sizes[size];

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {/* Label & Description */}
      {(label || description) && (
        <div className="flex-1 mr-4">
          {label && (
            <label
              onClick={!disabled ? handleChange : undefined}
              className={`
                text-sm font-medium block
                ${disabled ? 'text-gray-500 cursor-not-allowed' : 'text-gray-200 cursor-pointer'}
              `}
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-sm text-gray-400 mt-1">
              {description}
            </p>
          )}
        </div>
      )}

      {/* Toggle Switch */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={handleChange}
        disabled={disabled}
        className={`
          relative inline-flex flex-shrink-0 rounded-full
          transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-offset-2
          focus:ring-indigo-500 focus:ring-offset-gray-900
          ${sizeConfig.track}
          ${disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer'
          }
          ${checked
            ? 'bg-indigo-600'
            : 'bg-gray-600'
          }
        `}
      >
        {/* Thumb */}
        <span
          className={`
            pointer-events-none inline-block rounded-full bg-white
            shadow transform ring-0 transition duration-200 ease-in-out
            ${sizeConfig.thumb}
            ${checked ? sizeConfig.translate : 'translate-x-0.5'}
          `}
        />
      </button>
    </div>
  );
};

export default Toggle;
