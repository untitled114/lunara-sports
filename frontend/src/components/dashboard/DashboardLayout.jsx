import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMessageContext } from '../../contexts/MessageContext';
import { useAuth } from '../../contexts/AuthContext';

const DashboardLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { unreadCount, urgentCount } = useMessageContext();
  const { userId, isAnonymous } = useAuth();

  // Note: Authentication check is handled by ProtectedRoute wrapper
  // No need for additional check here

  // Body scroll lock when mobile menu is open
  React.useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    // Clear auth tokens
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_name');

    // Redirect to signin using React Router
    navigate('/signin');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header id="header" role="banner" className="bg-white shadow-lg fixed top-0 w-full z-40 transition-shadow duration-300">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/dashboard" className="text-2xl font-bold text-gray-800 tracking-tight">
              Lunara
            </Link>

            {/* Desktop Navigation */}
            <nav role="navigation" aria-label="Main navigation" className="hidden md:flex space-x-1">
              <Link
                to="/dashboard"
                className={`nav-link px-3 py-2 text-sm font-medium rounded-lg transition duration-150 ${
                  isActive('/dashboard') ? 'active bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:text-indigo-600'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/projects"
                className={`nav-link px-3 py-2 text-sm font-medium rounded-lg transition duration-150 relative ${
                  isActive('/projects') ? 'active bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:text-indigo-600'
                }`}
              >
                Projects <span className="nav-badge ml-1 bg-indigo-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">7</span>
              </Link>
              <Link
                to="/payments"
                className={`nav-link px-3 py-2 text-sm font-medium rounded-lg transition duration-150 relative ${
                  isActive('/payments') ? 'active bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:text-indigo-600'
                }`}
              >
                Payments <span className="nav-badge urgent ml-1 bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">2</span>
              </Link>
              <Link
                to="/messages"
                className={`nav-link px-3 py-2 text-sm font-medium rounded-lg transition duration-150 relative ${
                  isActive('/messages') ? 'active bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:text-indigo-600'
                }`}
              >
                Messages <span className="ml-1 bg-indigo-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
              </Link>
            </nav>

            {/* Header Actions */}
            <div className="hidden md:flex items-center space-x-4">
              {/* User ID Display */}
              {userId && (
                <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                  <span className="font-medium">User: </span>
                  <span className="font-mono text-xs">{userId.substring(0, 8)}...</span>
                  {isAnonymous && <span className="ml-1 text-xs text-orange-600">(Guest)</span>}
                </div>
              )}

              {/* Notifications */}
              <button
                className="relative p-2 rounded-full hover:bg-gray-100 transition duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                title={`${urgentCount} urgent notifications`}
                aria-label={`${urgentCount} urgent notifications`}
              >
                🚨
                {urgentCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full ring-2 ring-white">
                    {urgentCount}
                  </span>
                )}
              </button>

              {/* Profile */}
              <Link to="/profile" className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-100 transition duration-150">
                <img
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face"
                  alt="User Avatar"
                  className="w-8 h-8 rounded-full object-cover"
                  loading="lazy"
                  crossOrigin="anonymous"
                />
                <span className="text-sm font-medium text-gray-700">Profile</span>
              </Link>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="btn btn-secondary px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition duration-150 shadow-sm"
              >
                Logout
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              id="mobile-menu"
              className="mobile-menu md:hidden p-2 rounded-lg"
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className={`block w-6 h-0.5 bg-gray-600 transition-all ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
              <span className={`block w-6 h-0.5 bg-gray-600 my-1 transition-all ${mobileMenuOpen ? 'opacity-0' : ''}`}></span>
              <span className={`block w-6 h-0.5 bg-gray-600 transition-all ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 md:hidden z-30 animate-fadeIn"
            onClick={() => setMobileMenuOpen(false)}
          ></div>

          {/* Slide-out Menu */}
          <div className="fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-white md:hidden z-40 shadow-2xl animate-slideInRight overflow-y-auto">
            {/* Menu Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Menu</h2>
                {userId && (
                  <p className="text-xs text-gray-500 font-mono mt-1">
                    {userId.substring(0, 12)}...
                    {isAnonymous && <span className="ml-1 text-orange-600">(Guest)</span>}
                  </p>
                )}
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition"
                aria-label="Close menu"
              >
                <span className="text-2xl text-gray-600">×</span>
              </button>
            </div>

            {/* Navigation Links */}
            <nav role="navigation" aria-label="Mobile navigation" className="flex flex-col p-4 space-y-2">
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={`text-lg p-3 rounded-lg transition duration-150 ${
                  isActive('/dashboard') ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/projects"
                onClick={() => setMobileMenuOpen(false)}
                className={`text-lg p-3 rounded-lg transition duration-150 flex items-center justify-between ${
                  isActive('/projects') ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span>Projects</span>
                <span className="bg-indigo-600 text-white text-sm font-bold px-2 py-0.5 rounded-full">7</span>
              </Link>
              <Link
                to="/payments"
                onClick={() => setMobileMenuOpen(false)}
                className={`text-lg p-3 rounded-lg transition duration-150 flex items-center justify-between ${
                  isActive('/payments') ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span>Payments</span>
                <span className="bg-red-600 text-white text-sm font-bold px-2 py-0.5 rounded-full">2</span>
              </Link>
              <Link
                to="/messages"
                onClick={() => setMobileMenuOpen(false)}
                className={`text-lg p-3 rounded-lg transition duration-150 flex items-center justify-between ${
                  isActive('/messages') ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span>Messages</span>
                <span className="bg-indigo-600 text-white text-sm font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
              </Link>
            </nav>

            {/* Menu Footer */}
            <div className="border-t border-gray-200 p-4 space-y-3 mt-auto">
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center px-4 py-3 font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition duration-150"
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="w-full text-center px-4 py-3 font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition duration-150"
              >
                Logout
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="pt-16">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
