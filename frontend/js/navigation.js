/**
 * Lunara Navigation System
 * Handles page transitions, scroll spy, and navigation for hybrid React/static pages
 */

// Global navigation helper with Firefox compatibility
window.LunaraNavigate = (function() {
    let isNavigating = false;

    return function(page) {
        if (isNavigating) {
            console.log('Navigation already in progress, ignoring');
            return;
        }

        isNavigating = true;
        console.log('Navigating to:', page);

        const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
        if (isFirefox) {
            setTimeout(() => {
                window.location.href = page;
            }, 100);
        } else {
            window.location.href = page;
        }
    };
})();

class LunaraNavigation {
    constructor() {
        this.activeSection = null;
        this.observer = null;
        this._onScroll = null;
        this.isNavigating = false;
        this.init();
    }

    init() {
        // Prevent browser from restoring scroll position
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }

        this.setupNavigation();
        this.observeReactSections();
        this.handleInitialHash();
        // Don't call setupScrollSpy here - let MutationObserver do it after React renders
        this.setupAuthCheck();
        this.setupPlaceholderMessages();
    }

    setupNavigation() {
        // Handle all navigation clicks with data-action
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.getAttribute('data-action');
            this.handleAction(action, e, target);
        });

        // Handle section navigation with data-section attribute
        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-section]');
            if (!link) return;

            e.preventDefault();
            const sectionId = link.getAttribute('data-section');
            this.scrollToSectionWhenReady(sectionId);
        });

        // Handle regular href navigation with validation
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;

            // Skip if this link has a data-action or data-section (already handled)
            if (link.hasAttribute('data-action') || link.hasAttribute('data-section')) return;

            const href = link.getAttribute('href');

            // Skip if it's a hash link for same page
            if (href.startsWith('#')) return;

            // Skip if it's an external link
            if (href.startsWith('http')) return;

            // Validate page exists
            this.validateAndNavigate(href, e);
        });
    }

    observeReactSections() {
        // Watch react-root for section insertions
        const reactRoot = document.getElementById('react-root');
        if (!reactRoot) return;

        this.observer = new MutationObserver(() => {
            console.log('🔄 React sections changed, refreshing scroll spy...');
            // Wait a bit for layout to stabilize
            setTimeout(() => {
                this.setupScrollSpy();
                // Force scroll to top if we're supposed to be at home
                if (!window.location.hash || window.location.hash === '#home') {
                    window.scrollTo(0, 0);
                }
            }, 100);
        });

        this.observer.observe(reactRoot, {
            childList: true,
            subtree: true
        });
    }

    scrollToSectionWhenReady(sectionId, maxAttempts = 30, attemptDelay = 50) {
        let attempts = 0;

        const tryScroll = () => {
            const section = document.getElementById(sectionId);
            if (section) {
                this.smoothScrollToSection(section, sectionId);
                return true;
            }
            return false;
        };

        // Try immediately
        if (tryScroll()) return;

        // Poll until section appears
        const interval = setInterval(() => {
            attempts++;
            if (tryScroll() || attempts >= maxAttempts) {
                clearInterval(interval);
                if (attempts >= maxAttempts) {
                    console.warn(`Section #${sectionId} not found after ${maxAttempts} attempts`);
                }
            }
        }, attemptDelay);
    }

    smoothScrollToSection(section, sectionId) {
        const header = document.getElementById('header');
        const headerHeight = header ? header.offsetHeight : 0;

        // Wait for next paint cycle to ensure layout is stable (fixes React sections)
        requestAnimationFrame(() => {
            const sectionTop = section.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = sectionTop - headerHeight - 80; // Consistent 80px padding for all

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });

            // Update URL hash without triggering page jump
            if (window.history && window.history.pushState) {
                window.history.pushState(null, null, `#${sectionId}`);
            }
        });
    }

    setupScrollSpy() {
        const sections = document.querySelectorAll('main section[id]');
        const navLinks = document.querySelectorAll('nav [data-section]');

        if (!sections.length) {
            console.log('No sections found for scroll spy');
            return;
        }

        // Remove old listener if exists
        if (this._onScroll) {
            window.removeEventListener('scroll', this._onScroll);
        }

        this._onScroll = () => {
            let current = null;
            const headerHeight = document.getElementById('header')?.offsetHeight || 0;

            sections.forEach((section) => {
                const rect = section.getBoundingClientRect();
                // Check if section is in viewport (with header offset)
                if (rect.top <= headerHeight + 100 && rect.bottom > headerHeight + 100) {
                    current = section.id;
                }
            });

            if (current && current !== this.activeSection) {
                this.activeSection = current;
                navLinks.forEach((link) => {
                    const isActive = link.getAttribute('data-section') === current;
                    link.classList.toggle('active', isActive);
                });
            }
        };

        window.addEventListener('scroll', this._onScroll);
        this._onScroll(); // Run once immediately
    }

    handleInitialHash() {
        // Force scroll to top immediately to prevent any auto-scroll
        window.scrollTo(0, 0);

        // Handle hash in URL if present
        if (window.location.hash && window.location.hash !== '#') {
            const sectionId = window.location.hash.substring(1);

            // Special handling for 'home' - just stay at top
            if (sectionId === 'home') {
                window.history.replaceState(null, null, '#home');
                return;
            }

            // For other sections, wait for React to render then scroll
            setTimeout(() => this.scrollToSectionWhenReady(sectionId), 800);
        } else {
            // No hash - ensure we stay at top and set home as active
            window.history.replaceState(null, null, '#home');
        }
    }

    handleAction(action, event, element) {
        event.preventDefault();
        event.stopPropagation();

        switch (action) {
            case 'sign-in':
                this.navigateToPage('signin.html');
                break;
            case 'sign-up':
                this.navigateToPage('signup.html');
                break;
            case 'go-home':
                this.navigateToPage('index.html');
                break;
            // Dashboard actions (both with and without 'go-' prefix)
            case 'dashboard':
            case 'go-dashboard':
                this.checkAuthAndNavigate('dashboard.html');
                break;
            case 'projects':
            case 'go-projects':
                this.checkAuthAndNavigate('projects.html');
                break;
            case 'payments':
            case 'go-payments':
                this.checkAuthAndNavigate('payments.html');
                break;
            case 'messages':
            case 'go-messages':
                this.checkAuthAndNavigate('messages.html');
                break;
            case 'profile':
            case 'go-profile':
                this.checkAuthAndNavigate('user_profile.html');
                break;
            case 'notifications':
                // Placeholder for notifications feature
                console.log('Notifications feature coming soon');
                alert('Notifications system is under development by your cousin!');
                break;
            case 'logout':
                this.handleLogout();
                break;
            default:
                console.warn('Unknown action:', action);
        }
    }

    navigateToPage(page) {
        if (typeof window.LunaraNavigate === 'function') {
            window.LunaraNavigate(page);
        } else {
            window.location.href = page;
        }
    }

    validateAndNavigate(href, event) {
        // Basic validation - check if it looks like a valid HTML file
        if (href.endsWith('.html') || href === '/' || href === '') {
            return; // Let browser handle it
        }

        // For other paths, validate before navigating
        console.log('Navigating to:', href);
    }

    checkAuthAndNavigate(page) {
        if (window.LunaraAPI && window.LunaraAPI.isAuthenticated()) {
            this.navigateToPage(page);
        } else {
            this.showAuthRequired();
        }
    }

    scrollToSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' });
        }
    }

    setupAuthCheck() {
        const currentPage = window.location.pathname.split('/').pop();
        if ((currentPage === 'signin.html' || currentPage === 'signup.html') &&
            window.LunaraAPI && window.LunaraAPI.isAuthenticated()) {
            this.navigateToPage('dashboard.html');
        }
    }

    handleLogout() {
        if (window.LunaraAPI) {
            window.LunaraAPI.logout().then(() => {
                this.showToast('Logged out successfully', 'success');
                setTimeout(() => {
                    this.navigateToPage('index.html');
                }, 500);
            });
        }
    }

    showAuthRequired() {
        this.showToast('Please sign in to access this page', 'warning');
        setTimeout(() => {
            this.navigateToPage('signin.html');
        }, 1500);
    }

    showToast(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Could implement actual toast UI here
    }

    setupPlaceholderMessages() {
        // Placeholder for future functionality
    }
}

// Initialize navigation
const navigation = new LunaraNavigation();

// Expose to window for React integration
window.navigation = navigation;
