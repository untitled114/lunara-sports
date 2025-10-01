import { Link } from 'react-router-dom';
import { ArrowRight, Shield } from 'lucide-react';

/**
 * Hero.jsx - React component for hero section
 */

const Hero = () => {
  const handleHowItWorks = (e) => {
    e.preventDefault();
    // Smooth scroll to how-it-works section
    const section = document.getElementById('how-it-works');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center pt-20 pb-16 md:pt-24 md:pb-20 bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-900"
    >
      {/* Content Container */}
      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 bg-indigo-500/10 border border-indigo-500/20 rounded-full backdrop-blur-sm">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium text-indigo-300">Trusted by professionals worldwide</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-tight mb-6 bg-gradient-to-r from-white via-indigo-100 to-indigo-200 bg-clip-text text-transparent">
            Your Projects. Fully Protected.
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl lg:text-2xl text-gray-300 leading-relaxed mb-10 max-w-3xl mx-auto">
            Lunara ensures your work, payments, and collaborations are handled with total trust and transparency. No surprises. Just results.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/signup"
              className="group flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl hover:from-indigo-500 hover:to-indigo-400 transition-all duration-300 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105 w-full sm:w-auto"
            >
              Launch Project Securely
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#how-it-works"
              onClick={handleHowItWorks}
              className="flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold text-indigo-300 border-2 border-indigo-500/30 rounded-xl hover:bg-indigo-500/10 hover:border-indigo-400 transition-all duration-300 w-full sm:w-auto"
            >
              See How It Works
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;