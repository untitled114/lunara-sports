import React from 'react';
import { useToast } from '../contexts/ToastContext';

const ToastContainer = () => {
  const { toasts, dismissToast } = useToast();

  const getToastStyles = (type) => {
    switch (type) {
      case 'success':
        return 'bg-green-600 text-white';
      case 'error':
        return 'bg-red-600 text-white';
      case 'info':
        return 'bg-blue-600 text-white';
      default:
        return 'bg-gray-800 text-white';
    }
  };

  const getToastIcon = (type) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'info':
        return 'i';
      default:
        return '!';
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-20 right-4 z-50 flex flex-col gap-3 max-w-sm"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${getToastStyles(toast.type)} px-6 py-4 rounded-lg shadow-2xl flex items-center justify-between gap-4 animate-slideInRight`}
          role="alert"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">{getToastIcon(toast.type)}</span>
            <p className="font-semibold text-sm">{toast.message}</p>
          </div>
          <button
            onClick={() => dismissToast(toast.id)}
            className="text-white/80 hover:text-white transition-colors text-xl leading-none"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
