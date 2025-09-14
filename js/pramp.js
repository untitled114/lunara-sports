/**
 * particle_accelerator.js - Recommended Version
 * Fixes: Global reference issue, multiple triggers, proper acceleration logic
 */

// Configuration
const ACCELERATION_CONFIG = {
  duration: 1500, // ms
  baseSpeed: { x: 0.0003, y: 0.0005 },
  maxBoost: 0.008,
  cooldownTime: 3000 // ms before allowing another acceleration
};

// State management
let particleAnimationActive = false;
let lastAccelerationTime = 0;

/**
 * Accelerate particle rotation when sections come into view
 */
function accelerateParticles() {
  // Check if particles exist and cooldown period has passed
  const now = Date.now();
  if (!window.particles || 
      particleAnimationActive || 
      (now - lastAccelerationTime) < ACCELERATION_CONFIG.cooldownTime) {
    return;
  }

  particleAnimationActive = true;
  lastAccelerationTime = now;
  
  const { duration, baseSpeed, maxBoost } = ACCELERATION_CONFIG;
  const startTime = now;
  
  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Smooth acceleration curve (starts slow, gets faster)
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const boost = maxBoost * easeProgress;
    
    // Apply rotation if particles still exist
    if (window.particles) {
      window.particles.rotation.y += baseSpeed.y + boost;
      window.particles.rotation.x += baseSpeed.x + (boost * 0.6);
    }
    
    if (progress < 1 && window.particles) {
      requestAnimationFrame(animate);
    } else {
      // Animation complete
      particleAnimationActive = false;
    }
  }
  
  animate();
}

/**
 * Initialize fade-in observer with particle acceleration
 */
function initParticleAccelerator() {
  const faders = document.querySelectorAll('.fade-in');
  
  if (!faders.length) {
    console.warn('particle_accelerator.js: No .fade-in elements found');
    return;
  }

  const appearOptions = { 
    threshold: 0.2,
    rootMargin: '0px 0px -10% 0px' // Trigger slightly before element is fully visible
  };
  
  const appearOnScroll = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Add fade-in class
        entry.target.classList.add('visible');
        
        // Trigger particle acceleration (with built-in safeguards)
        accelerateParticles();
        
        // Stop observing this element
        observer.unobserve(entry.target);
      }
    });
  }, appearOptions);

  // Start observing all fade-in elements
  faders.forEach(fader => appearOnScroll.observe(fader));
}

/**
 * Wait for particles to be available, then initialize
 */
function init() {
  // If particles already exist, initialize immediately
  if (window.particles) {
    initParticleAccelerator();
    return;
  }
  
  // Otherwise, wait for particles to be created
  const checkForParticles = () => {
    if (window.particles) {
      initParticleAccelerator();
    } else {
      // Check again in 100ms
      setTimeout(checkForParticles, 100);
    }
  };
  
  checkForParticles();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/**
 * Manual trigger function (optional)
 * Call this if you want to trigger acceleration manually
 */
window.triggerParticleAcceleration = accelerateParticles;

/*
USAGE NOTES:

1. This script expects window.particles to be available (from your Three.js particle system)

2. Make sure your Three.js script creates particles BEFORE this script runs, or use:
   window.particles = particles; // in your Three.js script

3. Required CSS for fade-in effect:
   .fade-in { opacity: 0; transform: translateY(20px); transition: all 0.8s ease; }
   .fade-in.visible { opacity: 1; transform: translateY(0); }

4. The acceleration effect will only trigger once every 3 seconds to prevent overuse
*/