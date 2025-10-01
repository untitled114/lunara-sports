import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './legacy-imports.js';

// Wait for DOM to be ready
const initReactApp = () => {
  const rootElement = document.getElementById('react-root');

  if (!rootElement) {
    console.error('❌ React root element not found');
    return;
  }

  console.log('🚀 Initializing React app with Vite...');

  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);

  console.log('✅ React app mounted successfully');

  // Refresh scroll spy after React sections are mounted
  setTimeout(() => {
    if (window.navigation?.setupScrollSpy) {
      window.navigation.setupScrollSpy();
    }
  }, 300);
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReactApp);
} else {
  initReactApp();
}
