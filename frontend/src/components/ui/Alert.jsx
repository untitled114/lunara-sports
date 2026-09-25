import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';

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
 *   action={<button className="text-sm underline">Extend session</button>}
 * />
 */
const VARIANTS = {
  success: { icon: CheckCircle, tone: 'bg-live/10 border-live/30 text-live' },
  error: { icon: AlertCircle, tone: 'bg-loss/10 border-loss/30 text-loss' },
  warning: { icon: AlertTriangle, tone: 'bg-warn/10 border-warn/30 text-warn' },
  info: { icon: Info, tone: 'bg-accent/10 border-accent/30 text-accent' },
};

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

  const config = VARIANTS[variant] ?? VARIANTS.info;
  const Icon = config.icon;
  const [toneBg, toneBorder, toneText] = config.tone.split(' ');

  return (
    <div className={clsx('flex gap-3 rounded-lg border p-4', toneBg, toneBorder, className)} role="alert">
      {/* Icon */}
      <div className="flex-shrink-0">
        <Icon className={clsx('h-5 w-5', toneText)} />
      </div>

      {/* Content */}
      <div className="flex-1">
        {title && <h4 className="t-body font-semibold text-text-1 mb-1">{title}</h4>}

        {description && <p className="t-small text-text-2">{description}</p>}

        {children && <div className="t-small text-text-2 mt-2">{children}</div>}

        {/* Action */}
        {action && <div className="mt-3">{action}</div>}
      </div>

      {/* Dismiss Button */}
      {dismissible && (
        <button
          onClick={handleDismiss}
          className={clsx('flex-shrink-0 hover:opacity-70 transition-opacity', toneText)}
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

export default Alert;
