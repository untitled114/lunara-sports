import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';

/**
 * Select Component
 *
 * Customizable dropdown select input with search functionality.
 *
 * @param {Array} options - Array of {value, label, disabled} objects
 * @param {string} value - Selected value
 * @param {function} onChange - Callback: (value) => {}
 * @param {string} placeholder - Placeholder text
 * @param {boolean} searchable - Enable search/filter
 * @param {boolean} disabled - Disable the select
 * @param {string} error - Error message
 * @param {string} className - Additional classes
 *
 * Usage:
 * <Select
 *   options={[
 *     { value: '1', label: 'Option 1' },
 *     { value: '2', label: 'Option 2', disabled: true }
 *   ]}
 *   value={selected}
 *   onChange={(val) => setSelected(val)}
 *   placeholder="Select an option"
 *   searchable
 * />
 */
const Select = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select an option',
  searchable = false,
  disabled = false,
  error,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const selectRef = useRef(null);
  const searchInputRef = useRef(null);

  // Find selected option
  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on search
  const filteredOptions =
    searchable && searchTerm
      ? options.filter((opt) => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
      : options;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleSelect = (option) => {
    if (!option.disabled) {
      onChange(option.value);
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div ref={selectRef} className={clsx('relative', className)}>
      {/* Select Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          't-small w-full flex items-center justify-between rounded-md border bg-surface-2 px-4 py-2 text-text-1 transition-colors',
          error ? 'border-loss' : 'border-border',
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-1 focus-visible:outline-2 outline-accent'
        )}
      >
        <span className={selectedOption ? 'text-text-1' : 'text-text-3'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={clsx('w-4 h-4 text-text-3 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Error Message */}
      {error && <p className="mt-1 t-small text-loss">{error}</p>}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 max-h-60 overflow-auto rounded-md border border-border bg-surface-1 shadow-xl">
          {/* Search Input */}
          {searchable && (
            <div className="p-2 border-b border-border">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="t-small w-full rounded-sm border border-border bg-surface-2 px-3 py-2 text-text-1 placeholder-text-3 focus-visible:outline-2 outline-accent"
              />
            </div>
          )}

          {/* Options List */}
          <div className="py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option)}
                  disabled={option.disabled}
                  className={clsx(
                    't-small w-full flex items-center justify-between px-4 py-2 text-left transition-colors',
                    option.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-2 cursor-pointer',
                    option.value === value ? 'bg-surface-2 text-text-1' : 'text-text-2'
                  )}
                >
                  <span>{option.label}</span>
                  {option.value === value && <Check className="w-4 h-4 text-accent" />}
                </button>
              ))
            ) : (
              <div className="px-4 py-6 text-center t-small text-text-2">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Select;
