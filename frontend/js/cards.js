/**
 * cards.js - Enhanced Dynamic Cards System
 * Creates and animates dynamic cards with improved error handling
 */

(function() {
  'use strict';

  // Card data configuration
  const cardsData = [
    {title: "Built for You", desc: "High-quality solutions without the corporate markup. Designed with care."},
    {title: "Reliability Matters", desc: "Every detail is intentional. Consistent performance."},
    {title: "Affordable Vision", desc: "Cheaper than 95% of the market — innovation is accessible."},
    {title: "Seamless Experience", desc: "From idea to reality, enjoy a clean and intuitive flow."}
  ];

  // Configuration
  const CONFIG = {
    animationDelay: 0.2, // seconds between card animations
    observerThreshold: 0.2,
    observerMargin: '0px 0px -50px 0px'
  };

  /**
   * Create and inject dynamic cards if container exists
   */
  function createDynamicCards() {
    const cardsContainer = document.querySelector('.cards-container');

    if (!cardsContainer) {
      return; // No container found, skip gracefully
    }

    try {
      cardsData.forEach((data, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.transitionDelay = `${index * CONFIG.animationDelay}s`;

        // Safely create card content
        const title = document.createElement('h3');
        title.textContent = data.title;

        const desc = document.createElement('p');
        desc.textContent = data.desc;

        card.appendChild(title);
        card.appendChild(desc);
        cardsContainer.appendChild(card);
      });

      console.log(`cards.js: Created ${cardsData.length} dynamic cards`);
    } catch (error) {
      console.error('cards.js: Error creating dynamic cards:', error);
    }
  }

  /**
   * Initialize card animation observer
   */
  function initCardAnimations() {
    // Check for Intersection Observer support
    if (!window.IntersectionObserver) {
      console.warn('cards.js: IntersectionObserver not supported, cards will be visible immediately');
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = 1;
          entry.target.style.transform = 'translateY(0)';

          // Unobserve after animation to improve performance
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: CONFIG.observerThreshold,
      rootMargin: CONFIG.observerMargin
    });

    // Observe all cards (both dynamic and static)
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
      observer.observe(card);
    });

    if (cards.length > 0) {
      console.log(`cards.js: Observing ${cards.length} cards for animation`);
    }
  }

  /**
   * Initialize the cards system
   */
  function init() {
    try {
      createDynamicCards();
      initCardAnimations();
    } catch (error) {
      console.error('cards.js: Initialization error:', error);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging
  if (typeof window !== 'undefined') {
    window.CardsSystem = {
      init: init,
      createCards: createDynamicCards,
      initAnimations: initCardAnimations
    };
  }

})();


