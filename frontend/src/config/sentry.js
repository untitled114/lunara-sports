/**
 * Sentry Configuration for Lunara Frontend
 *
 * Initializes Sentry error tracking and performance monitoring
 * Only active when VITE_SENTRY_DSN is configured
 */

import * as Sentry from '@sentry/react';
import logger from '../utils/logger';

// Note: React Router integration requires router instance
// which should be configured in App.jsx after router creation

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const SENTRY_ENVIRONMENT = import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development';
const IS_PRODUCTION = import.meta.env.PROD;
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

// Only initialize Sentry if DSN is configured
export function initializeSentry() {
  if (!SENTRY_DSN) {
    logger.log('📊 Sentry not configured - skipping initialization');
    logger.log('💡 Set VITE_SENTRY_DSN to enable error tracking');
    return false;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENVIRONMENT,
      release: `lunara-frontend@${APP_VERSION}`,

      // Performance Monitoring
      integrations: [
        // Automatically instrument React components
        Sentry.browserTracingIntegration(),

        // Capture user feedback
        Sentry.feedbackIntegration({
          colorScheme: 'light',
          autoInject: false, // Manual injection for better control
        }),

        // Note: React Router integration can be added after router creation
        // See: https://docs.sentry.io/platforms/javascript/guides/react/features/react-router/
      ],

      // Performance Monitoring - Sample Rate
      // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring
      // Reduce in production to avoid excessive data
      tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0, // 10% in prod, 100% in dev

      // Session Replay - Sample Rate
      // Captures user sessions for debugging
      replaysSessionSampleRate: IS_PRODUCTION ? 0.1 : 0, // 10% in prod, disabled in dev
      replaysOnErrorSampleRate: 1.0, // Always capture when error occurs

      // Filter out sensitive data
      beforeSend(event, hint) {
        // Don't send events in development unless explicitly enabled
        const sentryDevEnabled = import.meta.env.VITE_SENTRY_DEV === 'true';
        if (!IS_PRODUCTION && !sentryDevEnabled) {
          logger.log('🚫 Sentry event blocked (development mode)');
          return null;
        }

        // Filter out sensitive information
        if (event.request) {
          delete event.request.cookies;

          // Remove auth tokens from headers
          if (event.request.headers) {
            delete event.request.headers.Authorization;
            delete event.request.headers.authorization;
          }
        }

        // Remove sensitive data from extra context
        if (event.extra) {
          delete event.extra.auth_token;
          delete event.extra.password;
        }

        return event;
      },

      // Ignore specific errors
      ignoreErrors: [
        // Browser extensions
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',

        // Network errors that are expected
        'NetworkError',
        'Network request failed',

        // Firebase auth expected errors
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
      ],

      // Capture console errors
      debug: !IS_PRODUCTION,
    });

    logger.log('✅ Sentry initialized successfully');
    logger.log(`📊 Environment: ${SENTRY_ENVIRONMENT}`);
    logger.log(`📊 Traces Sample Rate: ${IS_PRODUCTION ? '10%' : '100%'}`);

    return true;
  } catch (error) {
    logger.error('❌ Sentry initialization failed:', error);
    return false;
  }
}

/**
 * Set user context for error tracking
 */
export function setSentryUser(user) {
  if (!SENTRY_DSN) return;

  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });

  logger.log('👤 Sentry user context set:', user.email);
}

/**
 * Clear user context (on logout)
 */
export function clearSentryUser() {
  if (!SENTRY_DSN) return;

  Sentry.setUser(null);
  logger.log('👤 Sentry user context cleared');
}

/**
 * Manually capture an exception
 */
export function captureException(error, context = {}) {
  if (!SENTRY_DSN) {
    logger.error('Exception (Sentry not configured):', error, context);
    return null;
  }

  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Manually capture a message
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (!SENTRY_DSN) {
    logger.log(`Message (Sentry not configured): [${level}] ${message}`, context);
    return null;
  }

  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(category, message, data = {}) {
  if (!SENTRY_DSN) return;

  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
  });
}

/**
 * Test Sentry integration
 */
export function testSentry() {
  if (!SENTRY_DSN) {
    console.warn('⚠️ Sentry is not configured. Set VITE_SENTRY_DSN to test error reporting.');
    return;
  }

  try {
    // Test with a custom error
    throw new Error('Sentry test error - this is intentional!');
  } catch (error) {
    captureException(error, {
      testMode: true,
      timestamp: new Date().toISOString(),
    });
    console.log('✅ Test error sent to Sentry. Check your Sentry dashboard.');
  }
}

// Export Sentry instance for advanced usage
export { Sentry };

export default {
  initializeSentry,
  setSentryUser,
  clearSentryUser,
  captureException,
  captureMessage,
  addBreadcrumb,
  testSentry,
};
