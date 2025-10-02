import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import './styles.css';
import App from './App.jsx';

// Initialize Sentry for error tracking
if (import.meta.env.VITE_ENABLE_SENTRY === 'true') {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0, // 10% in production, 100% in dev
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    // Error filtering
    beforeSend(event, hint) {
      // Don't send errors in development unless explicitly enabled
      if (import.meta.env.DEV && import.meta.env.VITE_SENTRY_DEV !== 'true') {
        return null;
      }
      return event;
    },
  });

  console.log('✅ Sentry error tracking initialized');
}

const rootElement = document.getElementById('react-root');

if (!rootElement) {
    // This should never happen in a standard Vite setup
    console.error('❌ React root element not found.');
} else {
    console.log('🚀 Starting Lunara App via Vite...');
    
    // The main React rendering call
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );

    console.log('✅ React app rendered.');
}
