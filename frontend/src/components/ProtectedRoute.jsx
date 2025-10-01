import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if LunaraAPI is available
        if (window.LunaraAPI && typeof window.LunaraAPI.isAuthenticated === 'function') {
          const authenticated = await window.LunaraAPI.isAuthenticated();
          setIsAuthenticated(authenticated);
        } else {
          // Fallback: check for auth token in localStorage
          const token = localStorage.getItem('auth_token');
          setIsAuthenticated(!!token);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to signin if not authenticated
  if (!isAuthenticated) {
    // Store the intended destination for redirect after login
    const currentPath = window.location.pathname;
    localStorage.setItem('redirect_after_login', currentPath);

    // Redirect to signin page using React Router
    return <Navigate to="/signin" replace />;
  }

  // Render protected content if authenticated
  return children;
};

export default ProtectedRoute;
