import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, AtSign, Key, Rocket, LogIn, Loader2 } from 'lucide-react';
import { authAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

const SignIn = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Call backend auth API
      const response = await authAPI.login(formData.email, formData.password);

      // Store auth token and user info
      if (response.token) {
        localStorage.setItem('auth_token', response.token);
      }
      if (response.user) {
        localStorage.setItem('user_email', response.user.email || formData.email);
        localStorage.setItem('user_name', response.user.name || response.user.username || '');
        if (response.user.id) {
          localStorage.setItem('user_id', response.user.id);
        }
      }

      showSuccess('Welcome back! Redirecting to dashboard...');

      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);

    } catch (error) {
      console.error('Login error:', error);

      let errorMessage = 'Login failed. Please check your credentials.';

      // Handle specific API error messages
      if (error.status === 401) {
        errorMessage = 'Invalid email or password.';
      } else if (error.status === 404) {
        errorMessage = 'No account found with this email.';
      } else if (error.status === 429) {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.data && error.data.message) {
        errorMessage = error.data.message;
      } else if (error.isNetworkError) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }

      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-40 bg-gray-900/95 backdrop-blur-sm shadow-lg border-b border-indigo-900/50">
        <div className="container mx-auto px-4 max-w-7xl h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2 text-xl font-bold text-white tracking-widest">
            <Rocket className="w-5 h-5 text-indigo-400" />
            <span>LUNARA</span>
          </Link>
          <div className="header-buttons space-x-3">
            <Link
              to="/signup"
              className="px-4 py-1.5 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition duration-200 shadow-md"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center py-24 mt-16 px-4">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-gray-800 p-10 md:p-12 rounded-2xl shadow-2xl border border-gray-700/50">
            {/* Icon and Title */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-full shadow-lg mb-5">
                <User className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white">
                Welcome back!
              </h1>
              <p className="text-indigo-300 mt-2 text-lg">Your workspace is waiting ✨</p>
            </div>

            {/* Sign In Form */}
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Email Field */}
              <div className="form-group">
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                    <AtSign className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition duration-200 hover:bg-gray-700/70"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="form-group">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                    <Key className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition duration-200 hover:bg-gray-700/70"
                  />
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex justify-between items-center text-sm pt-1">
                <label className="flex items-center text-gray-300 hover:text-white transition duration-200 cursor-pointer">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                    className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-offset-0 mr-2.5"
                  />
                  Remember me
                </label>
                <Link to="/forgot-password" className="text-indigo-400 hover:text-indigo-300 transition duration-200 font-medium">
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center px-6 py-4 text-lg font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl hover:from-indigo-500 hover:to-indigo-400 transition-all duration-300 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 disabled:from-indigo-400 disabled:to-indigo-400 disabled:cursor-not-allowed disabled:shadow-none mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    Log Me In
                  </>
                )}
              </button>

              {/* Sign Up Link */}
              <div className="pt-6 border-t border-gray-700/50 mt-8">
                <p className="text-center text-gray-400">
                  Don't have an account?{' '}
                  <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 transition duration-200 font-semibold">
                    Sign Up
                  </Link>
                </p>
              </div>

              <p className="text-center text-xs text-gray-500 mt-4">
                🔒 Fast, secure login. Your workspace stays safe.
              </p>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-gray-500 border-t border-gray-800">
        Lunara Portal (v1.0) - All rights reserved.
      </footer>
    </div>
  );
};

export default SignIn;
