/**
 * SafeSend Navigation System
 * Handles page transitions and navigation for the entire application
 */

// Global navigation helper with Firefox compatibility
window.SafeSendNavigate = (function() {
    let isNavigating = false;

    return function(page) {
        // Prevent multiple rapid navigation calls
        if (isNavigating) {
            console.log('Navigation already in progress, ignoring');
            return;
        }

        isNavigating = true;
        console.log('Navigating to:', page);

        // Firefox-specific: Use delay to prevent NS_BINDING_ABORTED
        const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
        if (isFirefox) {
            setTimeout(() => {
                window.location.href = page;
            }, 100); // 100ms delay for Firefox
        } else {
            window.location.href = page;
        }
    };
})();

class SafeSendNavigation {
    constructor() {
        this.isNavigating = false;
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupAuthCheck();
        this.setupPlaceholderMessages();
    }

    setupNavigation() {
        // Handle all navigation clicks
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.getAttribute('data-action');
            this.handleAction(action, e, target);
        });

        // Handle regular href navigation with validation
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;

            // Skip if this link has a data-action (already handled by first listener)
            if (link.hasAttribute('data-action')) return;

            const href = link.getAttribute('href');

            // Skip if it's a hash link for same page
            if (href.startsWith('#')) return;

            // Skip if it's an external link
            if (href.startsWith('http')) return;

            // Validate page exists
            this.validateAndNavigate(href, e);
        });
    }

    handleAction(action, event, element) {
        event.preventDefault();
        event.stopPropagation(); // Prevent other listeners from firing

        switch (action) {
            case 'sign-in':
                this.navigateToPage('signin.html');
                break;

            case 'sign-up':
            case 'start-project':
            case 'start-freelancing':
            case 'hire-talent':
                this.navigateToPage('signup.html');
                break;

            case 'go-home':
                this.navigateToPage('index.html');
                break;

            case 'dashboard':
                this.checkAuthAndNavigate('dashboard.html');
                break;

            case 'projects':
                this.checkAuthAndNavigate('projects.html');
                break;

            case 'messages':
                this.checkAuthAndNavigate('messages.html');
                break;

            case 'payments':
                this.checkAuthAndNavigate('payments.html');
                break;

            case 'profile':
                this.checkAuthAndNavigate('user_profile.html');
                break;

            case 'support':
                this.navigateToPage('support.html');
                break;

            case 'logout':
                this.handleLogout();
                break;

            case 'how-it-works':
                this.scrollToSection('how-it-works');
                break;

            // Placeholder actions for features in development
            case 'file-upload':
                this.showPlaceholder('File Upload', 'This feature is coming soon! You\'ll be able to upload and manage project files securely.');
                break;

            case 'video-call':
                this.showPlaceholder('Video Calls', 'Video conferencing integration is in development. Stay tuned for seamless collaboration!');
                break;

            case 'advanced-search':
                this.showPlaceholder('Advanced Search', 'Enhanced search and filtering capabilities are coming soon!');
                break;

            case 'notifications':
                this.showPlaceholder('Notifications', 'Real-time notification system is being implemented. You\'ll get instant updates soon!');
                break;

            case 'analytics':
                this.showPlaceholder('Analytics', 'Detailed analytics and reporting features are in development!');
                break;

            default:
                console.log(`Unhandled action: ${action}`);
                this.showPlaceholder('Feature Coming Soon', `The "${action}" feature is being developed. Check back soon!`);
        }
    }

    validateAndNavigate(href, event) {
        // List of valid pages
        const validPages = [
            'index.html', 'signin.html', 'signup.html', 'dashboard.html',
            'projects.html', 'messages.html', 'payments.html',
            'user_profile.html', 'support.html'
        ];

        // Extract page name from href
        const pageName = href.split('/').pop() || 'index.html';

        if (validPages.includes(pageName)) {
            // Page exists, allow navigation
            return;
        } else {
            // Page doesn't exist, show placeholder
            event.preventDefault();
            this.showPlaceholder('Page Coming Soon', `The page "${pageName}" is currently in development.`);
        }
    }

    navigateToPage(page) {
        // Use global navigation helper
        window.SafeSendNavigate(page);
    }

    checkAuthAndNavigate(page) {
        // Check if user is authenticated
        if (window.SafeSendAPI && window.SafeSendAPI.isAuthenticated()) {
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
        // Redirect to dashboard if already authenticated and on signin/signup pages
        const currentPage = window.location.pathname.split('/').pop();
        if ((currentPage === 'signin.html' || currentPage === 'signup.html') &&
            window.SafeSendAPI && window.SafeSendAPI.isAuthenticated()) {
            this.navigateToPage('dashboard.html');
        }
    }

    handleLogout() {
        if (window.SafeSendAPI) {
            window.SafeSendAPI.logout().then(() => {
                this.showToast('Logged out successfully', 'success');
                // Clear any cached data
                if (window.DataSync) {
                    window.DataSync.clearCache();
                }
                // Stop real-time updates
                if (window.RealTimeUpdates) {
                    window.RealTimeUpdates.stop();
                }
                this.navigateToPage('index.html');
            }).catch((error) => {
                console.error('Logout error:', error);
                this.showToast('Logout failed', 'error');
                // Force redirect even if logout API fails
                setTimeout(() => {
                    this.navigateToPage('index.html');
                }, 1000);
            });
        } else {
            this.navigateToPage('index.html');
        }
    }

    showAuthRequired() {
        this.showToast('Please sign in to access this feature', 'warning');
        setTimeout(() => {
            this.navigateToPage('signin.html');
        }, 1500);
    }

    showPlaceholder(title, message) {
        // Create and show modal for placeholder features
        const modal = document.createElement('div');
        modal.className = 'placeholder-modal';
        modal.innerHTML = `
            <div class="placeholder-modal-content">
                <div class="placeholder-icon">🚧</div>
                <h3>${title}</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="this.closest('.placeholder-modal').remove()">
                    Got it!
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 5000);
    }

    showToast(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 100);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    setupPlaceholderMessages() {
        // Add CSS for modals and toasts if not already present
        if (!document.getElementById('navigation-styles')) {
            const styles = document.createElement('style');
            styles.id = 'navigation-styles';
            styles.textContent = `
                .placeholder-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    animation: fadeIn 0.3s ease;
                }

                .placeholder-modal-content {
                    background: white;
                    padding: 2rem;
                    border-radius: 12px;
                    text-align: center;
                    max-width: 400px;
                    margin: 1rem;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                }

                .placeholder-icon {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                }

                .placeholder-modal h3 {
                    margin: 0 0 1rem 0;
                    color: #333;
                }

                .placeholder-modal p {
                    margin: 0 0 1.5rem 0;
                    color: #666;
                    line-height: 1.5;
                }

                .toast {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 1rem 1.5rem;
                    border-radius: 8px;
                    color: white;
                    font-weight: 500;
                    z-index: 10001;
                    transform: translateX(100%);
                    transition: transform 0.3s ease;
                }

                .toast.show {
                    transform: translateX(0);
                }

                .toast-success {
                    background: #10b981;
                }

                .toast-error {
                    background: #ef4444;
                }

                .toast-warning {
                    background: #f59e0b;
                }

                .toast-info {
                    background: #3b82f6;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
            `;
            document.head.appendChild(styles);
        }
    }
}

// Initialize navigation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.SafeSendNavigation = new SafeSendNavigation();
});

// Also initialize if the script loads after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.SafeSendNavigation = new SafeSendNavigation();
    });
} else {
    window.SafeSendNavigation = new SafeSendNavigation();
}