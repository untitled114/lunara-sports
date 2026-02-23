import React from 'react';
import { Check, Minus } from 'lucide-react';

/**
 * Checkbox Component
 *
 * Customizable checkbox with label support.
 *
 * @param {boolean} checked - Checkbox state
 * @param {function} onChange - Callback: (checked) => {}
 * @param {string} label - Label text
 * @param {string} description - Additional description
 * @param {boolean} disabled - Disable the checkbox
 * @param {boolean} indeterminate - Partial selection state
 * @param {string} error - Error message
 * @param {string} className - Additional classes
 *
 * Usage:
 * <Checkbox
 *   checked={isChecked}
 *   onChange={(val) => setIsChecked(val)}
 *   label="Accept terms and conditions"
 *   description="By checking this box, you agree to our terms."
 * />
 */
const Checkbox = ({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  indeterminate = false,
  error,
  className = '',
  id,
}) => {
  const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

  const handleChange = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  return (
    <div className={`flex items-start ${className}`}>
      {/* Checkbox */}
      <div className="flex items-center h-5">
        <button
          type="button"
          role="checkbox"
          aria-checked={indeterminate ? 'mixed' : checked}
          aria-labelledby={label ? `${checkboxId}-label` : undefined}
          onClick={handleChange}
          disabled={disabled}
          className={`
            w-5 h-5 rounded border flex items-center justify-center
            transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
            focus:ring-indigo-500 focus:ring-offset-gray-900
            ${disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'cursor-pointer'
            }
            ${checked || indeterminate
              ? 'bg-indigo-600 border-indigo-600'
              : 'bg-gray-700 border-gray-600 hover:border-gray-500'
            }
            ${error ? 'border-red-500' : ''}
          `}
        >
          {indeterminate ? (
            <Minus className="w-3 h-3 text-white" />
          ) : checked ? (
            <Check className="w-3 h-3 text-white" />
          ) : null}
        </button>
      </div>

      {/* Label & Description */}
      {(label || description) && (
        <div className="ml-3">
          {label && (
            <label
              id={`${checkboxId}-label`}
              htmlFor={checkboxId}
              onClick={!disabled ? handleChange : undefined}
              className={`
                text-sm font-medium
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
          {error && (
            <p className="text-sm text-red-400 mt-1">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Checkbox;
