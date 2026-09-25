import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

/**
 * Dropdown - Reusable dropdown menu component
 *
 * @param {Object} props
 * @param {React.ReactNode} props.trigger - Button/element that opens dropdown
 * @param {Array} props.items - Array of menu items: { label, icon, onClick, disabled, divider }
 * @param {string} props.position - 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
 * @param {string} props.className - Additional classes
 *
 * @example
 * <Dropdown
 *   trigger={<button>Options</button>}
 *   items={[
 *     { label: 'Edit', icon: Edit, onClick: () => {} },
 *     { divider: true },
 *     { label: 'Delete', icon: Trash, onClick: () => {}, disabled: false }
 *   ]}
 *   position="bottom-right"
 * />
 */
const Dropdown = ({ trigger, items = [], position = 'bottom-left', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

  // Filter out dividers to get focusable items
  const focusableItems = items.filter((item) => !item.divider && !item.disabled);

  // Position classes mapping
  const positionClasses = {
    'bottom-left': 'top-full left-0 mt-2',
    'bottom-right': 'top-full right-0 mt-2',
    'top-left': 'bottom-full left-0 mb-2',
    'top-right': 'bottom-full right-0 mb-2',
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setFocusedIndex(-1);
        break;

      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const nextIndex = prev + 1;
          return nextIndex >= focusableItems.length ? 0 : nextIndex;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const prevIndex = prev - 1;
          return prevIndex < 0 ? focusableItems.length - 1 : prevIndex;
        });
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusableItems[focusedIndex]) {
          focusableItems[focusedIndex].onClick?.();
          setIsOpen(false);
          setFocusedIndex(-1);
        }
        break;

      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;

      case 'End':
        e.preventDefault();
        setFocusedIndex(focusableItems.length - 1);
        break;

      default:
        break;
    }
  };

  // Handle item click
  const handleItemClick = (item) => {
    if (!item.disabled && !item.divider) {
      item.onClick?.();
      setIsOpen(false);
      setFocusedIndex(-1);
    }
  };

  // Toggle dropdown
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setFocusedIndex(0);
    } else {
      setFocusedIndex(-1);
    }
  };

  return (
    <div ref={dropdownRef} className={clsx('relative inline-block', className)} onKeyDown={handleKeyDown}>
      {/* Trigger */}
      <div onClick={toggleDropdown}>
        {trigger || (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-4 py-2 text-text-1 transition-colors hover:bg-surface-1 focus-visible:outline-2 outline-accent"
            aria-haspopup="true"
            aria-expanded={isOpen}
          >
            Options
            <ChevronDown className={clsx('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
          </button>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className={clsx(
            'absolute z-50 min-w-[200px] rounded-md border border-border bg-surface-1 py-1 shadow-xl',
            positionClasses[position]
          )}
          role="menu"
          aria-orientation="vertical"
        >
          {items.map((item, index) => {
            // Render divider
            if (item.divider) {
              return <div key={`divider-${index}`} className="my-1 border-t border-border" role="separator" />;
            }

            // Find focusable index
            const focusableIndex = focusableItems.findIndex((fi) => items.indexOf(fi) === index);
            const isFocused = focusableIndex === focusedIndex;

            const Icon = item.icon;

            return (
              <button
                key={item.label || index}
                type="button"
                className={clsx(
                  't-small flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                  item.disabled ? 'text-text-3 cursor-not-allowed' : 'text-text-2 hover:bg-surface-2 hover:text-text-1 cursor-pointer',
                  isFocused && !item.disabled && 'bg-surface-2 text-text-1'
                )}
                onClick={() => handleItemClick(item)}
                disabled={item.disabled}
                role="menuitem"
                tabIndex={isFocused ? 0 : -1}
              >
                {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
                <span className="flex-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
