// js/button_logic.js

// Placeholder user/account state
function isLoggedIn() {
    // For now, always false
    return false;
}

function hasAccount() {
    // For now, always false
    return false;
}

document.addEventListener('DOMContentLoaded', () => {
    // Select all elements with data-action
    document.querySelectorAll('[data-action]').forEach(el => {
        el.addEventListener('click', (e) => {
            const action = el.dataset.action;

            switch(action) {
                // Landing page buttons
                case 'start-project': // Get Started
                    if (isLoggedIn()) {
                        alert('Redirect to Dashboard (Start Project)');
                    } else {
                        alert('Redirect to Sign Up / Log In placeholder');
                    }
                    break;

                case 'sign-in': // Sign In
                    if (hasAccount()) {
                        alert('Redirect to Sign In page');
                    } else {
                        alert('Redirect to Sign Up placeholder');
                    }
                    break;

                case 'sign-up': // Sign Up (if we add later)
                    if (isLoggedIn()) {
                        alert('Redirect to Dashboard (already signed in)');
                    } else {
                        alert('Redirect to Sign Up page placeholder');
                    }
                    break;

                case 'start-freelancing': // Start Freelancing
                    alert('Redirect to Sign Up page with role=freelancer');
                    break;

                case 'hire-talent': // Hire Talent
                    alert('Redirect to Sign Up page with role=client (placeholder)');
                    break;

                // Logo scroll
                case 'go-home':
                    document.querySelector('#home').scrollIntoView({ behavior: 'smooth' });
                    break;

                // Smooth scroll buttons
                case 'how-it-works':
                    document.querySelector('#how-it-works').scrollIntoView({ behavior: 'smooth' });
                    break;

                default:
                    console.log(`Clicked element: ${el.textContent}`);
            }

            e.preventDefault();
        });
    });
});
