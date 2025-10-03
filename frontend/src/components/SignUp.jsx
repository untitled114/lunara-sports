import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, AtSign, Key, User, Rocket, Loader2 } from 'lucide-react';
import { authAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

const SignUp = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
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

    // Validation
    if (formData.password !== formData.confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      showError('Password must be at least 6 characters long');
      return;
    }

    if (!formData.agreeToTerms) {
      showError('Please agree to the Terms of Service');
      return;
    }

    setLoading(true);

    try {
      // Call backend auth API
      const response = await authAPI.signup({
        email: formData.email,
        password: formData.password,
        password_confirm: formData.confirmPassword,
        name: formData.fullName,
        username: formData.email.split('@')[0], // Generate username from email
      });

      // Store auth token and user info (Django JWT format uses 'access' not 'token')
      const token = response.access || response.token;
      if (token) {
        localStorage.setItem('auth_token', token);
      }
      if (response.refresh) {
        localStorage.setItem('refresh_token', response.refresh);
      }
      if (response.user) {
        localStorage.setItem('user_email', response.user.email || formData.email);
        localStorage.setItem('user_name', response.user.name || formData.fullName);
        if (response.user.id) {
          localStorage.setItem('user_id', response.user.id);
        }
      }

      showSuccess('Account created! Redirecting to dashboard...');

      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);

    } catch (error) {
      console.error('Sign up error:', error);

      let errorMessage = 'Sign up failed. Please try again.';

      // Handle specific API error messages
      if (error.status === 400) {
        if (error.data && error.data.email) {
          errorMessage = 'An account with this email already exists.';
        } else if (error.data && error.data.message) {
          errorMessage = error.data.message;
        }
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
              to="/signin"
              className="px-4 py-1.5 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition duration-200 shadow-md"
            >
              Sign In
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
                <UserPlus className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white">
                Create Account
              </h1>
              <p className="text-indigo-300 mt-2 text-lg">Join Lunara today! 🚀</p>
            </div>

            {/* Sign Up Form */}
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Full Name Field */}
              <div className="form-group">
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition duration-200 hover:bg-gray-700/70"
                  />
                </div>
              </div>

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
                    placeholder="Create a strong password (6+ characters)"
                    required
                    minLength={6}
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition duration-200 hover:bg-gray-700/70"
                  />
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="form-group">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                    <Key className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    required
                    minLength={6}
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition duration-200 hover:bg-gray-700/70"
                  />
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start text-sm pt-2">
                <input
                  type="checkbox"
                  id="agreeToTerms"
                  name="agreeToTerms"
                  checked={formData.agreeToTerms}
                  onChange={handleChange}
                  className="w-4 h-4 mt-1 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-offset-0 mr-3 flex-shrink-0"
                  required
                />
                <label htmlFor="agreeToTerms" className="text-gray-300 leading-relaxed">
                  I agree to the{' '}
                  <Link to="/terms" className="text-indigo-400 hover:text-indigo-300 transition duration-200 font-medium">
                    Terms of Service
                  </Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="text-indigo-400 hover:text-indigo-300 transition duration-200 font-medium">
                    Privacy Policy
                  </Link>
                </label>
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
                    Creating Account...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5 mr-2" />
                    Create Account
                  </>
                )}
              </button>

              {/* Sign In Link */}
              <div className="pt-6 border-t border-gray-700/50 mt-8">
                <p className="text-center text-gray-400">
                  Already have an account?{' '}
                  <Link to="/signin" className="text-indigo-400 hover:text-indigo-300 transition duration-200 font-semibold">
                    Sign In
                  </Link>
                </p>
              </div>

              <p className="text-center text-xs text-gray-500 mt-4">
                🔒 Your data is encrypted and secure.
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

export default SignUp;
