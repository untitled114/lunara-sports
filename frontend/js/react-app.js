/**
 * react-app.js - React Application Entry Point
 *
 * Mounts Hero and Features components inside proper <section> wrappers
 * so scroll spy, navigation, and animations work correctly.
 */

(function() {
  'use strict';

  let reactInitialized = false;

  function initReactApp() {
    if (reactInitialized) return;

    if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
      console.error('React or ReactDOM not loaded.');
      return;
    }

    const rootElement = document.getElementById('react-root');
    if (!rootElement) {
      console.error('React root element not found');
      return;
    }

    waitForComponents()
      .then(() => {
        renderApp(rootElement);
        reactInitialized = true;
      })
      .catch((err) => {
        console.error('Failed to load React components:', err);
        showFallbackContent(rootElement);
      });
  }

  function waitForComponents() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50;
      const interval = setInterval(() => {
        attempts++;
        if (window.Hero && window.Features) {
          clearInterval(interval);
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error('Components loading timeout'));
        }
      }, 100);
    });
  }

  function renderApp(rootElement) {
    const { Hero, Features } = window;

    const App = () => React.createElement(
      React.Fragment,
      null,
      React.createElement("section", { id: "home", className: "section fade-in" },
        React.createElement(Hero)
      ),
      React.createElement("section", { id: "features", className: "section fade-in" },
        React.createElement(Features)
      )
    );

    ReactDOM.createRoot(rootElement).render(React.createElement(App));

    console.log('🚀 React App mounted with #home and #features sections');

    // Refresh scroll spy for newly added sections
    if (window.navigation && typeof window.navigation.setupScrollSpy === 'function') {
      setTimeout(() => window.navigation.setupScrollSpy(), 100);
    }

    // Dispatch event for other scripts
    window.dispatchEvent(new CustomEvent('reactAppReady', {
      detail: { timestamp: Date.now() }
    }));
  }

  function showFallbackContent(rootElement) {
    const Fallback = () =>
      React.createElement('div', { style: { padding: '20px', textAlign: 'center', color: '#999' } },
        'Loading interactive components...'
      );

    ReactDOM.createRoot(rootElement).render(React.createElement(Fallback));
  }

  // Initialize React when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReactApp);
  } else {
    initReactApp();
  }

  window.LunaraReact = {
    initialized: () => reactInitialized,
    reinitialize: () => {
      reactInitialized = false;
      initReactApp();
    }
  };

})();
