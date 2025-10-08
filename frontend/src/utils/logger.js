/**
 * Environment-aware logging utility for Lunara frontend
 *
 * Automatically disables debug logging in production builds while keeping
 * warn and error logging active for production debugging.
 *
 * Usage:
 *   import logger from '@/utils/logger';
 *   logger.log('Debug info');      // Only in development
 *   logger.warn('Warning');         // Always logged
 *   logger.error('Error');          // Always logged
 */

const isDevelopment = import.meta.env.DEV;

const logger = {
  /**
   * Debug logging - only active in development
   * Use for general debugging, state changes, API calls
   */
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Debug logging - only active in development
   * Use for verbose debugging information
   */
  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * Info logging - only active in development
   * Use for informational messages
   */
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Warning logging - always active
   * Use for recoverable errors or unexpected behavior
   */
  warn: (...args) => {
    console.warn(...args);
  },

  /**
   * Error logging - always active
   * Use for errors that need tracking in production
   */
  error: (...args) => {
    console.error(...args);
  },

  /**
   * API call logging - only active in development
   * Structured logging for API requests
   */
  api: (method, url, data = null) => {
    if (isDevelopment) {
      const timestamp = new Date().toISOString();
      console.log(`[API ${method}] ${url}`, { timestamp, data });
    }
  },

  /**
   * Component lifecycle logging - only active in development
   * Use in React components for lifecycle debugging
   */
  component: (name, action, data = null) => {
    if (isDevelopment) {
      console.log(`[Component: ${name}] ${action}`, data);
    }
  },

  /**
   * Auth flow logging - only active in development
   * Use for authentication and authorization debugging
   */
  auth: (action, data = null) => {
    if (isDevelopment) {
      console.log(`[Auth] ${action}`, data);
    }
  },

  /**
   * Group start - only in development
   */
  group: (label) => {
    if (isDevelopment) {
      console.group(label);
    }
  },

  /**
   * Group end - only in development
   */
  groupEnd: () => {
    if (isDevelopment) {
      console.groupEnd();
    }
  },

  /**
   * Table logging - only in development
   * Useful for displaying arrays of objects
   */
  table: (data) => {
    if (isDevelopment) {
      console.table(data);
    }
  },
};

export default logger;
