/**
 * Hero.jsx - React component for hero section
 * Converted from static HTML while preserving all classes and structure
 */

const Hero = () => {
  const handleSignUp = (e) => {
    e.preventDefault();
    console.log('Sign up button clicked');

    // Reuse existing navigation system
    if (typeof window.LunaraNavigate === 'function') {
      console.log('Using LunaraNavigate');
      window.LunaraNavigate('signup.html');
    } else {
      // Fallback to direct navigation
      console.log('Fallback: direct navigation');
      window.location.href = '/signup.html';
    }
  };

  const handleHowItWorks = (e) => {
    e.preventDefault();
    console.log('How it works button clicked');

    // Smooth scroll to how-it-works section
    const section = document.getElementById('how-it-works');
    if (section) {
      console.log('Scrolling to how-it-works section');
      section.scrollIntoView({ behavior: 'smooth' });
    } else {
      console.log('how-it-works section not found');
    }
  };

  return (
    <section id="home" className="hero">
      <div className="container">
        <div className="hero-content">
          <h1 className="hero-title">Your Projects. Fully Protected.</h1>
          <p className="hero-subtitle">
            Lunara ensures your work, payments, and collaborations are handled with total trust and transparency. No surprises. Just results.
          </p>
          <div className="cta-buttons">
            <a
              href="/signup.html"
              className="btn btn-primary"
              onClick={handleSignUp}
            >
              Launch Project Securely
            </a>
            <a
              href="#how-it-works"
              className="btn btn-secondary"
              onClick={handleHowItWorks}
            >
              See How It Works
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

// Export for use in react-app.js
window.Hero = Hero;