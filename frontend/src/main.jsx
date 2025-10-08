import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { initializeSentry } from './config/sentry';

// Initialize Sentry error tracking (only if DSN is configured)
initializeSentry();

ReactDOM.createRoot(document.getElementById('react-root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
