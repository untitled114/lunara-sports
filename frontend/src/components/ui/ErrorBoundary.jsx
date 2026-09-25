import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 *
 * Usage:
 * <ErrorBoundary>
 *   <YourApp />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Report the error during development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Log to error reporting service in production
    if (import.meta.env.PROD && window.Sentry) {
      window.Sentry.captureException(error, { extra: errorInfo });
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-surface-card border border-border rounded-lg p-8 text-center">
            {/* Error Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-loss/10 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-loss" />
              </div>
            </div>

            {/* Error Message */}
            <h1 className="t-title text-text-1 mb-2">Something went wrong</h1>
            <p className="t-body text-text-2 mb-6">
              We're sorry for the inconvenience. The application encountered an unexpected error.
            </p>

            {/* Error Details (Development Only) */}
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 rounded-lg bg-surface-2 p-4 text-left">
                <p className="t-small font-mono text-loss mb-2">{this.state.error.toString()}</p>
                {this.state.errorInfo && (
                  <details className="t-small font-mono text-text-3">
                    <summary className="cursor-pointer hover:text-text-2">Stack trace</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words">{this.state.errorInfo.componentStack}</pre>
                  </details>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="t-small flex-1 flex items-center justify-center gap-2 rounded-md bg-accent-fill px-4 py-3 font-medium text-white hover:bg-accent-fill-hover transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
              <button
                onClick={this.handleGoHome}
                className="t-small flex-1 flex items-center justify-center gap-2 rounded-md bg-surface-2 px-4 py-3 font-medium text-text-1 hover:bg-surface-1 transition-colors border border-border"
              >
                <Home className="w-4 h-4" />
                Go home
              </button>
            </div>

            {/* Support Link */}
            <p className="mt-6 t-small text-text-3">
              If this problem persists,{' '}
              <a href="mailto:support@playbyplay.app" className="text-accent hover:text-accent-hover">
                contact support
              </a>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
