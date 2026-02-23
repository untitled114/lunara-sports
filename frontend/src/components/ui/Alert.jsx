import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

/**
 * Alert Component
 *
 * Display important messages, warnings, errors, or success notifications.
 *
 * @param {string} variant - Alert type: success, error, warning, info
 * @param {string} title - Alert title (optional)
 * @param {string} description - Alert message/description
 * @param {boolean} dismissible - Show close button
 * @param {function} onDismiss - Callback when dismissed
 * @param {ReactNode} action - Optional action button
 * @param {string} className - Additional CSS classes
 *
 * Usage:
 * <Alert variant="success" title="Success!" description="Your changes have been saved." />
 * <Alert variant="error" description="An error occurred" dismissible />
 * <Alert
 *   variant="warning"
 *   title="Warning"
 *   description="Your session will expire in 5 minutes"
 *   action={<button className="text-sm underline">Extend Session</button>}
 * />
 */
const Alert = ({
  variant = 'info',
  title,
  description,
  dismissible = false,
  onDismiss,
  action,
  className = '',
  children,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (!isVisible) return null;

  // Variant configurations
  const variants = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-900/20',
      borderColor: 'border-green-500/50',
      iconColor: 'text-green-500',
      titleColor: 'text-green-400',
      textColor: 'text-green-300',
    },
    error: {
      icon: AlertCircle,
      bgColor: 'bg-red-900/20',
      borderColor: 'border-red-500/50',
      iconColor: 'text-red-500',
      titleColor: 'text-red-400',
      textColor: 'text-red-300',
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-900/20',
      borderColor: 'border-yellow-500/50',
      iconColor: 'text-yellow-500',
      titleColor: 'text-yellow-400',
      textColor: 'text-yellow-300',
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-900/20',
      borderColor: 'border-blue-500/50',
      iconColor: 'text-blue-500',
      titleColor: 'text-blue-400',
      textColor: 'text-blue-300',
    },
  };

  const config = variants[variant];
  const Icon = config.icon;

  return (
    <div
      className={`
        flex gap-3 p-4 rounded-lg border
        ${config.bgColor}
        ${config.borderColor}
        ${className}
      `}
      role="alert"
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        <Icon className={`w-5 h-5 ${config.iconColor}`} />
      </div>

      {/* Content */}
      <div className="flex-1">
        {title && (
          <h4 className={`text-sm font-semibold mb-1 ${config.titleColor}`}>
            {title}
          </h4>
        )}

        {description && (
          <p className={`text-sm ${config.textColor}`}>
            {description}
          </p>
        )}

        {children && (
          <div className={`text-sm ${config.textColor} mt-2`}>
            {children}
          </div>
        )}

        {/* Action */}
        {action && (
          <div className="mt-3">
            {action}
          </div>
        )}
      </div>

      {/* Dismiss Button */}
      {dismissible && (
        <button
          onClick={handleDismiss}
          className={`flex-shrink-0 ${config.iconColor} hover:opacity-70 transition-opacity`}
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default Alert;
