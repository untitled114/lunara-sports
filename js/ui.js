/**
 * js/ui.js
 * Basic UI wiring for Lunara:
 * - reveal-on-scroll (IntersectionObserver)
 * - header .scrolled toggle
 * - scrollspy (nav highlight)
 * - mobile menu toggle
 * - CTA data-action wiring
 * - subtle hero parallax (mouse)
 *
 * Drop this file at js/ui.js — your HTML already includes js/ui.js in the footer.
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
    const rect = el.getBoundingClientRect();
    const top = window.scrollY + rect.top;
    window.scrollTo({
      top,
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
      items.forEach(i => i.classList.add('animate'));
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate');
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
      if (window.scrollY > 20) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(check);
        ticking = true;
      }
    }, { passive: true });

    // run once
    check();
  }

  /* -------------------------
     Scroll-spy (nav highlight)
     ------------------------- */
  function initScrollSpy() {
    const sections = Array.from(document.querySelectorAll('main section[id]'));
    const navLinks = Array.from(document.querySelectorAll('.nav-link'));
    const mobileLinks = Array.from(document.querySelectorAll('.mobile-nav-link'));
    if (!sections.length) return;

    // Observe when section is mostly visible
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach(a => a.classList.toggle('active', a.dataset.section === id));
          mobileLinks.forEach(a => a.classList.toggle('active', a.dataset.section === id));
        }
      });
    }, {
      threshold: [0.5]
    });

    sections.forEach(s => observer.observe(s));

    // also enable click-on-nav to smooth scroll
    [...navLinks, ...mobileLinks].forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const target = a.getAttribute('href') || `#${a.dataset.section}`;
        if (target) scrollToSelector(target);
      });
    });
  }

  /* -------------------------
     Mobile menu toggle
     ------------------------- */
  function initMobileMenu() {
    const btn = document.getElementById('mobile-menu');
    const overlay = document.getElementById('mobile-nav-overlay');
    if (!btn || !overlay) return;

    btn.addEventListener('click', () => {
      const open = btn.classList.toggle('active');
      overlay.classList.toggle('active', open);
      document.body.classList.toggle('mobile-nav-open', open);
    });

    // close when clicking outside or clicking a link
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        btn.classList.remove('active');
        overlay.classList.remove('active');
        document.body.classList.remove('mobile-nav-open');
      }
    });

    overlay.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        btn.classList.remove('active');
        overlay.classList.remove('active');
        document.body.classList.remove('mobile-nav-open');
      });
    });
  }

  /* -------------------------
     CTA Buttons wiring (data-action attributes)
     Supported actions: start-project, how-it-works, start-freelancing, hire-talent
     ------------------------- */
  function initCTAButtons() {
    document.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const action = el.dataset.action && el.dataset.action.trim();
        switch (action) {
          case 'start-project':
            scrollToSelector('#dashboard'); break;
          case 'how-it-works':
            scrollToSelector('#how-it-works'); break;
          case 'start-freelancing':
            scrollToSelector('#dashboard'); break;
          case 'hire-talent':
            scrollToSelector('#pricing'); break;
          default:
            // if action looks like a selector (#something) try it
            if (action && action.startsWith('#')) scrollToSelector(action);
            else console.warn('ui.js: Unrecognized data-action:', action);
        }

        // tiny click feedback
        el.classList.add('btn-pressed');
        setTimeout(() => el.classList.remove('btn-pressed'), 180);
      });

      // keyboard activation for non-button elements
      el.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          el.click();
        }
      });
    });
  }

  /* -------------------------
     Hero parallax (mouse-based, subtle)
     - disabled if user prefers reduced motion
     ------------------------- */
  function initHeroParallax() {
    if (prefersReducedMotion) return;
    const hero = document.querySelector('.hero');
    const content = document.querySelector('.hero-content');
    if (!hero || !content) return;

    let mouseX = 0, mouseY = 0;
    let posX = 0, posY = 0;
    const ease = 0.09;

    hero.addEventListener('mousemove', (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      mouseX = x * 16; // px
      mouseY = y * 10;
    });

    hero.addEventListener('mouseleave', () => {
      mouseX = 0;
      mouseY = 0;
    });

    function update() {
      posX += (mouseX - posX) * ease;
      posY += (mouseY - posY) * ease;
      content.style.transform = `translate3d(${posX}px, ${posY}px, 0)`;
      requestAnimationFrame(update);
    }
    update();
  }

  /* -------------------------
     Initialize
     ------------------------- */
  function init() {
    initRevealOnScroll();
    initHeaderScroll();
    initScrollSpy();
    initMobileMenu();
    initCTAButtons();
    initHeroParallax();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
