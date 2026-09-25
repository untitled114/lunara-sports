import React from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';

/**
 * ConfirmDialog - Reusable confirmation modal
 *
 * @param {boolean} isOpen - Dialog open state
 * @param {function} onClose - Close handler
 * @param {function} onConfirm - Confirm action handler
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message/description
 * @param {string} [confirmText] - Confirm button text
 * @param {string} [cancelText] - Cancel button text
 * @param {string} [variant] - Visual variant: 'danger'|'warning'|'info'
 * @param {boolean} [loading] - Loading state for confirm button
 */
const VARIANTS = {
  danger: { iconColor: 'text-loss', iconBg: 'bg-loss/10', button: 'bg-loss hover:bg-loss/80' },
  warning: { iconColor: 'text-warn', iconBg: 'bg-warn/10', button: 'bg-warn hover:bg-warn/80' },
  info: { iconColor: 'text-accent', iconBg: 'bg-accent/10', button: 'bg-accent-fill hover:bg-accent-fill-hover' },
};

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  loading = false,
}) => {
  if (!isOpen) return null;

  const config = VARIANTS[variant] || VARIANTS.warning;
  const Icon = AlertTriangle;

  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-0/80"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onClose}
    >
      <div className="bg-surface-1 border border-border rounded-lg shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={clsx('p-2 rounded-md', config.iconBg)}>
              <Icon className={clsx('w-6 h-6', config.iconColor)} aria-hidden="true" />
            </div>
            <h3 id="confirm-dialog-title" className="t-section text-text-1">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-text-3 hover:bg-surface-2 hover:text-text-1 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="t-body text-text-2">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <button
            onClick={onClose}
            disabled={loading}
            className="t-small px-4 py-2 bg-surface-2 text-text-2 rounded-md font-medium hover:bg-surface-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={clsx(
              't-small px-4 py-2 text-text-1 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2',
              config.button
            )}
          >
            {loading && <span className="w-4 h-4 border-2 border-text-1/30 border-t-text-1 rounded-sm animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

ConfirmDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  variant: PropTypes.oneOf(['danger', 'warning', 'info']),
  loading: PropTypes.bool,
};

export default ConfirmDialog;
