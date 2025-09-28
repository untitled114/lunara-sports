/**
 * Authentication handlers for SafeSend
 * Handles sign-in, sign-up, and authentication flow
 */

class AuthManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupFormHandlers();
        this.checkAuthenticationStatus();
    }

    setupFormHandlers() {
        // Sign-in form handler
        const signinForm = document.getElementById('signin-form');
        if (signinForm) {
            signinForm.addEventListener('submit', (e) => this.handleSignIn(e));
        }

        // Sign-up form handler
        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => this.handleSignUp(e));
        }
    }

    checkAuthenticationStatus() {
        // Check if user is already authenticated
        if (window.SafeSendAPI && window.SafeSendAPI.isAuthenticated()) {
            const currentPage = window.location.pathname.split('/').pop();

            // Redirect authenticated users away from auth pages
            if (currentPage === 'signin.html' || currentPage === 'signup.html') {
                this.redirectToDashboard();
            }
        } else {
            // Redirect unauthenticated users from protected pages
            const protectedPages = ['dashboard.html', 'projects.html', 'payments.html', 'messages.html', 'user_profile.html'];
            const currentPage = window.location.pathname.split('/').pop();

            if (protectedPages.includes(currentPage)) {
                this.redirectToSignIn();
            }
        }
    }

    async handleSignIn(event) {
        event.preventDefault();

        const form = event.target;
        const submitButton = form.querySelector('button[type="submit"]');
        const email = form.querySelector('input[type="email"]').value;
        const password = form.querySelector('input[type="password"]').value;

        // Validate inputs
        if (!email || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        // Show loading state
        this.setButtonLoading(submitButton, true);

        try {
            // Attempt login
            const response = await window.SafeSendAPI.login(email, password);

            // Success
            this.showSuccess('Welcome back! Redirecting to dashboard...');

            // Redirect to dashboard after short delay
            setTimeout(() => {
                this.redirectToDashboard();
            }, 1500);

        } catch (error) {
            console.error('Login error:', error);
            this.showError(error.message || 'Login failed. Please check your credentials.');
        } finally {
            this.setButtonLoading(submitButton, false);
        }
    }

    async handleSignUp(event) {
        event.preventDefault();

        const form = event.target;
        const submitButton = form.querySelector('button[type="submit"]');
        const inputs = form.querySelectorAll('input');

        // Extract form data
        const formData = {
            username: inputs[0].value, // Name field
            email: inputs[1].value,
            password: inputs[2].value,
            user_type: this.detectUserType(form) // Default or from radio buttons
        };

        // Validate inputs
        if (!formData.username || !formData.email || !formData.password) {
            this.showError('Please fill in all fields');
            return;
        }

        if (!this.isValidEmail(formData.email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        if (formData.password.length < 6) {
            this.showError('Password must be at least 6 characters long');
            return;
        }

        // Show loading state
        this.setButtonLoading(submitButton, true);

        try {
            // Attempt registration
            const response = await window.SafeSendAPI.register(formData);

            // Success
            this.showSuccess('Account created successfully! Redirecting to dashboard...');

            // Redirect to dashboard after short delay
            setTimeout(() => {
                this.redirectToDashboard();
            }, 1500);

        } catch (error) {
            console.error('Registration error:', error);
            this.showError(error.message || 'Registration failed. Please try again.');
        } finally {
            this.setButtonLoading(submitButton, false);
        }
    }

    detectUserType(form) {
        // Check for user type radio buttons
        const userTypeRadio = form.querySelector('input[name="user-type"]:checked');
        if (userTypeRadio) {
            return userTypeRadio.value;
        }

        // Default to freelancer
        return 'freelancer';
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.textContent = 'Please wait...';
            button.classList.add('loading');
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || button.textContent;
            button.classList.remove('loading');
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type) {
        // Use the notification system from api.js if available
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            // Fallback to alert
            alert(message);
        }
    }

    redirectToDashboard() {
        window.location.href = 'dashboard.html';
    }

    redirectToSignIn() {
        window.location.href = 'signin.html';
    }
}

// Initialize authentication manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on an auth page or need auth protection
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const authPages = ['signin.html', 'signup.html'];
    const protectedPages = ['dashboard.html', 'projects.html', 'payments.html', 'messages.html', 'user_profile.html'];

    if (authPages.includes(currentPage) || protectedPages.includes(currentPage)) {
        new AuthManager();
    }
});

// Global function for logout (used by navigation)
window.performLogout = async function() {
    try {
        if (window.SafeSendAPI) {
            await window.SafeSendAPI.logout();
        }
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        // Force redirect even if logout fails
        window.location.href = 'index.html';
    }
};