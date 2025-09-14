// button_logic.js

document.addEventListener('DOMContentLoaded', () => {

    // Helper function for navigation
    const navigate = (url) => {
        window.location.href = url;
    };

    // Button Actions
    const buttonActions = {
        'start-project': () => navigate('signup.html'),
        'sign-in': () => navigate('signin.html'),
        'sign-up': () => navigate('signup.html'),
        'start-freelancing': () => navigate('signup.html'),
        'hire-talent': () => navigate('signup.html'), // TBD
        'go-home': () => navigate('index.html'),
        'how-it-works': () => {
            const section = document.querySelector('#how-it-works');
            if (section) {
                section.scrollIntoView({ behavior: 'smooth' });
            }
        }
    };

    // Attach to buttons with data-action
    const buttons = document.querySelectorAll('[data-action]');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const action = btn.getAttribute('data-action');
            if (buttonActions[action]) {
                buttonActions[action]();
            }
        });
    });

});
