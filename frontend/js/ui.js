/**
 * ui.js - Enhanced Version
 * Minor improvements for better compatibility with your specific HTML structure
 * and performance optimizations
 */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -------------------------
     Helper: safe scroll to selector
     ------------------------- */
  function scrollToSelector(selector) {
    const el = document.querySelector(selector);
    if (!el) {
      console.warn('ui.js: target not found ->', selector);
      return;
    }
    
    // Account for fixed header height
    const headerHeight = 80; // Adjust based on your header height
    const rect = el.getBoundingClientRect();
    const top = window.scrollY + rect.top - headerHeight;
    
    window.scrollTo({
      top: Math.max(0, top),
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });
  }

  /* -------------------------
     Reveal-on-scroll for elements that use .fade-in, .fade-in-up, .slide-in-left/right
     ------------------------- */
  function initRevealOnScroll() {
    const selectors = '.fade-in, .fade-in-up, .slide-in-left, .slide-in-right';
    const items = Array.from(document.querySelectorAll(selectors));
    if (!items.length) return;

    // If reduced motion, reveal immediately
    if (prefersReducedMotion) {
      items.forEach(i => i.classList.add('animate', 'visible'));
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate', 'visible');
          obs.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -8% 0px'
    });

    items.forEach(item => observer.observe(item));
  }

  /* -------------------------
     Header scrolled state
     ------------------------- */
  function initHeaderScroll() {
    const header = document.getElementById('header') || document.querySelector('header');
    if (!header) return;

    let ticking = false;
    function check() {
      const scrolled = window.scrollY > 20;
      header.classList.toggle('scrolled', scrolled);
      ticking = false;
    }
    
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(check);
        ticking = true;
      }
    }, { passive: true });

    // Run once on load
    check();
  }

  /* -------------------------
     Scroll-spy (nav highlight)
     Updated to work with your HTML structure
     ------------------------- */
  function initScrollSpy() {
    const sections = Array.from(document.querySelectorAll('main section[id]'));
    const navLinks = Array.from(document.querySelectorAll('.nav-link[data-section]'));
    const mobileLinks = Array.from(document.querySelectorAll('.mobile-nav-link[data-section]'));
    
    if (!sections.length) return;

    // Also handle nav links without data-section but with href
    const allNavLinks = [
      ...navLinks,
      ...Array.from(document.querySelectorAll('.nav-link[href^="#"]:not([data-section])')),
    ];
    const allMobileLinks = [
      ...mobileLinks,
      ...Array.from(document.querySelectorAll('.mobile-nav-link[href^="#"]:not([data-section])')),
    ];

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          
          // Handle data-section links
          [...navLinks, ...mobileLinks].forEach(a => {
            a.classList.toggle('active', a.dataset.section === id);
          });
          
          // Handle href links
          [...allNavLinks, ...allMobileLinks].forEach(a => {
            if (!a.dataset.section) {
              const href = a.getAttribute('href');
              a.classList.toggle('active', href === `#${id}`);
            }
          });
        }
      });
    }, {
      threshold: [0.3], // Slightly higher threshold for better UX
      rootMargin: '-80px 0px -50% 0px' // Account for header height
    });

    sections.forEach(s => observer.observe(s));

    // Enable click-on-nav to smooth scroll
    [...allNavLinks, ...allMobileLinks].forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const target = a.dataset.section ? `#${a.dataset.section}` : a.getAttribute('href');
        if (target && target.startsWith('#')) {
          scrollToSelector(target);
        }
      });
    });
  }

  /* -------------------------
     Mobile menu toggle
     ------------------------- */
  function initMobileMenu() {
    const btn = document.getElementById('mobile-menu') || document.querySelector('.mobile-menu');
    const overlay = document.getElementById('mobile-nav-overlay') || document.querySelector('.mobile-nav-overlay');
    
    if (!btn || !overlay) {
      console.warn('ui.js: Mobile menu elements not found. Expected #mobile-menu and #mobile-nav-overlay');
      return;
    }

    function openMenu() {
      btn.classList.add('active');
      overlay.classList.add('active');
      document.body.classList.add('mobile-nav-open');
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    function closeMenu() {
      btn.classList.remove('active');
      overlay.classList.remove('active');
      document.body.classList.remove('mobile-nav-open');
      document.body.style.overflow = ''; // Restore scroll
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = btn.classList.contains('active');
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Close when clicking outside
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeMenu();
      }
    });

    // Close when clicking any link
    overlay.querySelectorAll('a, .btn').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && btn.classList.contains('active')) {
        closeMenu();
      }
    });

    // Close on window resize (if mobile menu is open and window gets larger)
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768 && btn.classList.contains('active')) {
        closeMenu();
      }
    });
  }

  /* -------------------------
     CTA Buttons wiring (data-action attributes)
     Updated with your specific sections
     ------------------------- */
  function initCTAButtons() {
    // Only attach listeners to scroll actions, not navigation actions
    const scrollActions = ['start-project', 'how-it-works', 'start-freelancing', 'hire-talent'];

    document.querySelectorAll('[data-action]').forEach(el => {
      const action = el.dataset.action && el.dataset.action.trim();

      // Skip if not a scroll action (let navigation.js handle navigation)
      if (!scrollActions.includes(action) && !action?.startsWith('#')) {
        return;
      }

      // Only attach listener for scroll actions
      el.addEventListener('click', (e) => {
        e.preventDefault();
        
        switch (action) {
          case 'start-project':
            scrollToSelector('#pricing');
            break;
          case 'how-it-works':
            scrollToSelector('#how-it-works');
            break;
          case 'start-freelancing':
            scrollToSelector('#pricing');
            break;
          case 'hire-talent':
            scrollToSelector('#pricing');
            break;
          default:
            // If action looks like a selector (#something) try it
            if (action && action.startsWith('#')) {
              scrollToSelector(action);
            } else if (action) {
              console.warn('ui.js: Unrecognized data-action:', action);
            }
        }

        // Button press feedback
        el.classList.add('btn-pressed');
        setTimeout(() => el.classList.remove('btn-pressed'), 180);
      });

      // Keyboard activation for accessibility
      if (el.tagName !== 'BUTTON' && el.tagName !== 'A') {
        el.setAttribute('tabindex', '0');
        el.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            el.click();
          }
        });
      }
    });
  }

  /* -------------------------
     Hero parallax (mouse-based, subtle)
     Enhanced with performance optimizations
     ------------------------- */
  function initHeroParallax() {
    if (prefersReducedMotion) return;
    
    const hero = document.querySelector('.hero');
    const content = document.querySelector('.hero-content');
    if (!hero || !content) return;

    let mouseX = 0, mouseY = 0;
    let posX = 0, posY = 0;
    const ease = 0.09;
    let animationId;

    function updateParallax() {
      posX += (mouseX - posX) * ease;
      posY += (mouseY - posY) * ease;
      
      // Only update if movement is significant enough
      if (Math.abs(mouseX - posX) > 0.1 || Math.abs(mouseY - posY) > 0.1) {
        content.style.transform = `translate3d(${posX}px, ${posY}px, 0)`;
        animationId = requestAnimationFrame(updateParallax);
      } else {
        // Stop animation when movement is minimal
        animationId = null;
      }
    }

    hero.addEventListener('mousemove', (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      mouseX = x * 16; // px
      mouseY = y * 10;
      
      // Start animation if not already running
      if (!animationId) {
        updateParallax();
      }
    });

    hero.addEventListener('mouseleave', () => {
      mouseX = 0;
      mouseY = 0;
      if (!animationId) {
        updateParallax();
      }
    });
  }

  /* -------------------------
     Initialize with better error handling
     ------------------------- */
  function init() {
    try {
      initRevealOnScroll();
      initHeaderScroll();
      initScrollSpy();
      initMobileMenu();
      initCTAButtons();
      initHeroParallax();
      
      // Initialization complete
    } catch (error) {
      console.error('ui.js: Error during initialization:', error);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose some functions globally for debugging (optional)
  if (typeof window !== 'undefined') {
    window.UIControls = {
      scrollTo: scrollToSelector,
      init: init
    };
  }

})();

/*
IMPROVEMENTS MADE:

1. ✅ Better ScrollSpy - Works with both data-section and href attributes
2. ✅ Enhanced Mobile Menu - Prevents background scroll, escape key support, resize handling  
3. ✅ Better Scroll Offset - Accounts for fixed header height
4. ✅ Performance - Optimized parallax animation
5. ✅ Error Handling - Try/catch blocks and better warnings
6. ✅ Accessibility - Proper tabindex and keyboard support
7. ✅ Fallback Selectors - Works even if IDs are missing
8. ✅ Debug Support - Global functions for troubleshooting

COMPATIBILITY NOTES:
- Works with your current HTML structure
- Handles both old and new navigation patterns
- Graceful fallbacks if elements are missing
- Better mobile experience 
*/