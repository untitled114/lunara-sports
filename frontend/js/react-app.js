/**
 * react-app.js - React Application Entry Point
 *
 * Full React control over "home" and "features" sections,
 * with fallback to static HTML if React fails.
 */

(function () {
  "use strict";

  let reactInitialized = false;

  function initReactApp() {
    console.log("🚀 Initializing React app...");

    if (reactInitialized) {
      console.log("React already initialized");
      return;
    }

    const rootElement = document.getElementById("react-root");
    if (!rootElement) {
      console.error("❌ React root element not found");
      return;
    }

    if (typeof React === "undefined" || typeof ReactDOM === "undefined") {
      console.error("❌ React not available — using fallback renderer");
      renderFallback(rootElement);
      return;
    }

    console.log("✅ React and ReactDOM available");

    waitForComponents()
      .then(() => {
        console.log("✅ React components loaded successfully");
        renderApp(rootElement);
        reactInitialized = true;
      })
      .catch((err) => {
        console.error("❌ React components failed to load:", err);
        renderFallback(rootElement);
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
        }
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error("Timeout waiting for React components"));
        }
      }, 100);
    });
  }

  function renderApp(rootElement) {
    const { Hero, Features } = window;

    // Hero and Features already return full <section> elements with IDs
    const App = () =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(Hero),
        React.createElement(Features)
      );

    ReactDOM.createRoot(rootElement).render(React.createElement(App));
    console.log("🚀 React App mounted inside #react-root");

    // Refresh scroll spy after React sections are mounted
    setTimeout(() => {
      if (window.navigation?.setupScrollSpy) {
        window.navigation.setupScrollSpy();
      }
    }, 300);
  }

  function renderFallback(rootElement) {
    rootElement.innerHTML = `
      <section id="home">
        <div class="hero-fallback">
          <h1>Welcome to Lunara</h1>
          <p>Fallback hero section (React not loaded).</p>
        </div>
      </section>

      <section id="features">
        <div class="features-fallback">
          <h2>Features</h2>
          <ul>
            <li>Fast, reliable, lightweight</li>
            <li>Built with React + static fallback</li>
            <li>No blank pages if JS fails</li>
          </ul>
        </div>
      </section>
    `;

    console.warn("⚠️ Static fallback rendered — React failed");
  }

  // Init
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReactApp);
  } else {
    initReactApp();
  }

  // Debug helper
  window.LunaraReact = {
    reinitialize: () => {
      reactInitialized = false;
      initReactApp();
    },
  };
})();
