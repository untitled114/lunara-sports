import React from 'react';
import { Check, Minus } from 'lucide-react';
import clsx from 'clsx';

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
    <div className={clsx('flex items-start', className)}>
      {/* Checkbox */}
      <div className="flex items-center h-5">
        <button
          type="button"
          role="checkbox"
          aria-checked={indeterminate ? 'mixed' : checked}
          aria-labelledby={label ? `${checkboxId}-label` : undefined}
          onClick={handleChange}
          disabled={disabled}
          className={clsx(
            'flex h-5 w-5 items-center justify-center rounded-sm border transition-colors focus-visible:outline-2 outline-accent',
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            checked || indeterminate
              ? 'bg-accent-fill border-accent-fill'
              : 'bg-surface-2 border-border hover:border-border-strong',
            error && 'border-loss'
          )}
        >
          {indeterminate ? (
            <Minus className="h-3 w-3 text-text-1" />
          ) : checked ? (
            <Check className="h-3 w-3 text-text-1" />
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
              className={clsx(
                't-small font-medium',
                disabled ? 'text-text-3 cursor-not-allowed' : 'text-text-1 cursor-pointer'
              )}
            >
              {label}
            </label>
          )}
          {description && <p className="t-small text-text-2 mt-1">{description}</p>}
          {error && <p className="t-small text-loss mt-1">{error}</p>}
        </div>
      )}
    </div>
  );
};

export default Checkbox;
