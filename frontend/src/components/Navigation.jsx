import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Rocket, LogIn } from 'lucide-react';

const NavLinks = [
    { name: 'Features', href: '#features' },
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Pricing', href: '#pricing' },
];

const Navigation = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    // Handles the fixed/sticky header appearance on scroll
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };

        // Attach scroll listener (passive for performance)
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    
    // Function for internal section links
    const handleLinkClick = () => {
        setIsMenuOpen(false);
    };

    // NEW HANDLER: Stops unwanted navigation and scrolls to the very top.
    const handleLogoClick = (e) => {
        e.preventDefault(); // Crucial: Prevents the default hash navigation behavior
        setIsMenuOpen(false);
        // Scrolls to the top of the page with a smooth animation
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    return (
        <header 
            className={`fixed top-0 left-0 w-full z-20 transition duration-300 ${
                isScrolled ? 'bg-gray-900/90 backdrop-blur-md shadow-lg border-b border-indigo-900/50' : 'bg-transparent'
            }`}
        >
            <div className="container mx-auto px-4 max-w-7xl h-20 flex items-center justify-between">
                
                {/* Logo / Brand - APPLYING THE FIX HERE */}
                <a 
                    href="/" // Changed to "/" to avoid appending index.html
                    className="flex items-center space-x-2 text-xl font-bold text-white tracking-widest" 
                    onClick={handleLogoClick} // Using the new dedicated handler
                >
                    <Rocket className="w-6 h-6 text-indigo-400" />
                    <span>LUNARA</span>
                </a>

                {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center space-x-4">
                    {NavLinks.map((link) => (
                        <a
                            key={link.name}
                            href={link.href}
                            className="text-gray-300 hover:text-indigo-400 transition duration-200 text-sm font-medium px-3"
                            onClick={handleLinkClick}
                        >
                            {link.name}
                        </a>
                    ))}
                    <Link
                        to="/signin"
                        className="flex items-center px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition duration-200"
                    >
                        <LogIn className="w-4 h-4 mr-1.5" />
                        Sign In
                    </Link>
                    <Link
                        to="/signup"
                        className="flex items-center px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition duration-200 shadow-md"
                    >
                        Sign Up
                    </Link>
                </nav>

                {/* Mobile Menu Button */}
                <button
                    className="lg:hidden p-2 text-gray-300 hover:text-white transition duration-200"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                    {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Mobile Navigation (Conditional Render) */}
            <nav
                className={`lg:hidden transition-all duration-300 overflow-hidden ${
                    isMenuOpen ? 'max-h-[28rem] opacity-100 py-6 border-t border-gray-800 bg-gray-900/95' : 'max-h-0 opacity-0'
                }`}
            >
                <div className="flex flex-col items-center space-y-5">
                    {NavLinks.map((link) => (
                        <a
                            key={link.name}
                            href={link.href}
                            className="text-gray-300 hover:text-indigo-400 transition duration-200 text-lg font-medium w-full text-center py-2"
                            onClick={handleLinkClick}
                        >
                            {link.name}
                        </a>
                    ))}
                    <div className="flex flex-col items-center space-y-3 w-full px-4 pt-2">
                        <Link
                            to="/signin"
                            className="flex items-center justify-center px-6 py-3 text-base font-medium text-gray-300 hover:text-white border border-gray-700 rounded-lg hover:border-indigo-500 transition duration-200 w-full max-w-xs"
                            onClick={handleLinkClick}
                        >
                            <LogIn className="w-4 h-4 mr-2" />
                            Sign In
                        </Link>
                        <Link
                            to="/signup"
                            className="flex items-center justify-center px-6 py-3 text-base font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition duration-200 shadow-md w-full max-w-xs"
                            onClick={handleLinkClick}
                        >
                            Sign Up
                        </Link>
                    </div>
                </div>
            </nav>
        </header>
    );
};

export default Navigation;
