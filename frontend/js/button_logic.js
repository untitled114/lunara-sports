/**
 * button_logic.js - Enhanced Button Actions Handler
 * Handles navigation and action buttons with improved error handling
 * Works alongside ui.js without conflicts
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    scrollBehavior: 'smooth',
    scrollOffset: 80, // Account for fixed header
    animationDuration: 300
  };

  /**
   * Safe navigation helper
   */
  function navigate(url) {
    try {
      if (url && typeof url === 'string') {
        window.location.href = url;
      } else {
        console.error('button_logic.js: Invalid URL for navigation:', url);
      }
    } catch (error) {
      console.error('button_logic.js: Navigation error:', error);
    }
  }

  /**
   * Enhanced smooth scroll with offset
   */
  function scrollToSection(selector) {
    try {
      const element = document.querySelector(selector);
      if (!element) {
        console.warn(`button_logic.js: Section not found: ${selector}`);
        return false;
      }

      const headerHeight = CONFIG.scrollOffset;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerHeight;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: CONFIG.scrollBehavior
      });

      return true;
    } catch (error) {
      console.error('button_logic.js: Scroll error:', error);
      return false;
    }
  }

  /**
   * Button action handlers
   */
  const buttonActions = {
    'start-project': () => navigate('signup.html'),
    'sign-in': () => navigate('signin.html'),
    'sign-up': () => navigate('signup.html'),
    'start-freelancing': () => navigate('signup.html'),
    'hire-talent': () => navigate('signup.html'),
    'go-home': () => navigate('index.html'),
    'get-started': () => navigate('signup.html'),

    // Section navigation
    'how-it-works': () => scrollToSection('#how-it-works'),
    'features': () => scrollToSection('#features'),
    'pricing': () => scrollToSection('#pricing'),
    'home': () => scrollToSection('#home'),

    // User profile actions (for future use)
    'profile': () => navigate('user_profile.html'),
    'settings': () => console.log('Settings functionality to be implemented'),
    'logout': () => {
      // Add logout logic here
      console.log('Logout functionality to be implemented');
      // navigate('signin.html');
    }
  };

  /**
   * Add visual feedback to button clicks
   */
  function addButtonFeedback(button) {
    button.classList.add('btn-pressed');
    setTimeout(() => {
      button.classList.remove('btn-pressed');
    }, CONFIG.animationDuration);
  }

  /**
   * Initialize button event listeners
   */
  function initButtonActions() {
    const buttons = document.querySelectorAll('[data-action]');

    if (buttons.length === 0) {
      return; // No action buttons found
    }

    buttons.forEach(button => {
      // Skip if already has listener (prevent duplicate listeners)
      if (button.hasAttribute('data-button-initialized')) {
        return;
      }

      button.addEventListener('click', (e) => {
        const action = button.getAttribute('data-action');

        if (!action) {
          console.warn('button_logic.js: Button has no data-action attribute');
          return;
        }

        // Add visual feedback
        addButtonFeedback(button);

        // Handle the action
        if (buttonActions[action]) {
          e.preventDefault();
          buttonActions[action]();
        } else {
          console.warn(`button_logic.js: Unknown action: ${action}`);
        }
      });

      // Mark as initialized
      button.setAttribute('data-button-initialized', 'true');
    });

    console.log(`button_logic.js: Initialized ${buttons.length} action buttons`);
  }

  /**
   * Initialize the button logic system
   */
  function init() {
    try {
      initButtonActions();
    } catch (error) {
      console.error('button_logic.js: Initialization error:', error);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging and external use
  if (typeof window !== 'undefined') {
    window.ButtonLogic = {
      init: init,
      navigate: navigate,
      scrollToSection: scrollToSection,
      addAction: (name, handler) => {
        buttonActions[name] = handler;
      }
    };
  }

})();
