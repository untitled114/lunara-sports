/**
 * scroll_animations.js - Recommended Version
 * Improvements: Better formatting, constants, error handling, performance
 */

// Configuration constants
const PROGRESS_HEIGHT = '4px';
const PROGRESS_Z_INDEX = '2000';
const SCROLL_THROTTLE = 10; // ms

/**
 * Smooth scroll for anchor links
 */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      const target = document.querySelector(targetId);
      
      if (target) {
        target.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      } else {
        console.warn(`scroll_animations.js: Target not found - ${targetId}`);
      }
    });
  });
}

/**
 * Create and manage scroll progress bar
 */
function initScrollProgress() {
  // Check if progress bar already exists
  if (document.getElementById('scroll-progress')) {
    return;
  }

  const progressBar = document.createElement('div');
  progressBar.id = 'scroll-progress';
  progressBar.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0%;
    height: ${PROGRESS_HEIGHT};
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    z-index: ${PROGRESS_Z_INDEX};
    transition: width 0.1s ease;
    pointer-events: none;
  `;
  
  document.body.appendChild(progressBar);

  // Throttled scroll handler for performance
  let scrollTimeout;
  function updateProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    
    if (docHeight > 0) {
      const scrollPercent = Math.min((scrollTop / docHeight) * 100, 100);
      progressBar.style.width = scrollPercent + '%';
    }
  }

  window.addEventListener('scroll', () => {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
    scrollTimeout = setTimeout(updateProgress, SCROLL_THROTTLE);
  }, { passive: true });

  // Initial update
  updateProgress();
}

/**
 * Initialize all scroll animations
 */
function init() {
  initSmoothScroll();
  initScrollProgress();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/**
 * Optional: Disable progress bar
 * Call this function if you want to remove the progress bar
 */
function disableScrollProgress() {
  const progressBar = document.getElementById('scroll-progress');
  if (progressBar) {
    progressBar.remove();
  }
}