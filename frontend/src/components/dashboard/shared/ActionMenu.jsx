import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { MoreVertical } from 'lucide-react';
import clsx from 'clsx';

/**
 * ActionMenu - Three-dot dropdown menu for row actions
 *
 * @param {Array} actions - Array of action objects: { label, icon, onClick, variant, divider }
 * @param {string} [align] - Menu alignment: 'left'|'right'
 */
const ActionMenu = ({ actions = [], align = 'right' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close menu on Escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleAction = (action) => {
    if (action.onClick) {
      action.onClick();
    }
    setIsOpen(false);
  };

  const getVariantClasses = (variant) => {
    switch (variant) {
      case 'danger':
        return 'text-loss hover:bg-loss/10';
      case 'warning':
        return 'text-warn hover:bg-warn/10';
      case 'success':
        return 'text-live hover:bg-live/10';
      default:
        return 'text-text-2 hover:bg-surface-2';
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md text-text-3 hover:bg-surface-2 hover:text-text-1 transition-colors"
        aria-label="Open actions menu"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {isOpen && (
        <div
          className={clsx(
            'absolute mt-2 w-48 bg-surface-1 border border-border rounded-md shadow-2xl z-50 py-1',
            align === 'left' ? 'left-0' : 'right-0'
          )}
          role="menu"
          aria-orientation="vertical"
        >
          {actions.map((action, index) => (
            <React.Fragment key={index}>
              {action.divider && index > 0 && <div className="my-1 border-t border-border" role="separator" />}
              <button
                onClick={() => handleAction(action)}
                disabled={action.disabled}
                className={clsx(
                  't-small w-full px-4 py-2 text-left flex items-center gap-3 transition-colors',
                  action.disabled ? 'opacity-50 cursor-not-allowed' : getVariantClasses(action.variant)
                )}
                role="menuitem"
                aria-disabled={action.disabled}
              >
                {action.icon && (
                  <span className="flex-shrink-0" aria-hidden="true">
                    {action.icon}
                  </span>
                )}
                <span>{action.label}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

ActionMenu.propTypes = {
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      icon: PropTypes.node,
      onClick: PropTypes.func,
      variant: PropTypes.oneOf(['default', 'danger', 'warning', 'success']),
      divider: PropTypes.bool,
      disabled: PropTypes.bool,
    })
  ).isRequired,
  align: PropTypes.oneOf(['left', 'right']),
};

export default ActionMenu;
