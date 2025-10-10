import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AtSign, KeyRound, Rocket, Send, ArrowLeft } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // TODO: Implement password reset API call
      // await authAPI.resetPassword(email);

      // Simulated delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      showSuccess('Password reset link sent! Check your email.');
      setEmailSent(true);

    } catch (error) {
      console.error('Password reset error:', error);
      showError('Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      showSuccess('Email resent! Check your inbox.');
    } catch (error) {
      showError('Failed to resend email. Please try again.');
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
            {!emailSent ? (
              <>
                {/* Icon and Title */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-full shadow-lg mb-5">
                    <KeyRound className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-3xl md:text-4xl font-extrabold text-white">
                    Forgot Password?
                  </h1>
                  <p className="text-gray-400 mt-2 text-base">
                    No worries! Enter your email and we'll send you reset instructions.
                  </p>
                </div>

                {/* Reset Form */}
                <form className="space-y-6" onSubmit={handleSubmit}>
                  {/* Email Field */}
                  <div className="form-group">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <AtSign className="w-5 h-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                        className="w-full pl-12 pr-4 py-3.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition duration-200 hover:bg-gray-700/70"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 text-lg font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl hover:from-indigo-500 hover:to-indigo-400 transition-all duration-300 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 disabled:from-indigo-400 disabled:to-indigo-400 disabled:cursor-not-allowed disabled:shadow-none mt-2"
                  >
                    <Send className="w-5 h-5" />
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>

                  {/* Back to Sign In */}
                  <div className="pt-6 border-t border-gray-700/50 mt-8">
                    <Link
                      to="/signin"
                      className="flex items-center justify-center text-gray-400 hover:text-indigo-400 transition duration-200 font-medium"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Sign In
                    </Link>
                  </div>
                </form>
              </>
            ) : (
              <>
                {/* Success State */}
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-600 to-green-500 rounded-full shadow-lg mb-5">
                    <Send className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
                    Check Your Email
                  </h1>
                  <p className="text-gray-400 text-base mb-2">
                    We sent a password reset link to:
                  </p>
                  <p className="text-indigo-300 font-semibold text-lg mb-6">
                    {email}
                  </p>
                  <p className="text-gray-400 text-sm mb-8">
                    Click the link in the email to reset your password. If you don't see it, check your spam folder.
                  </p>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <button
                      onClick={handleResendEmail}
                      disabled={loading}
                      className="w-full px-6 py-3 text-base font-semibold text-indigo-300 border-2 border-indigo-500/30 rounded-xl hover:bg-indigo-500/10 hover:border-indigo-400 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Resending...' : 'Resend Email'}
                    </button>
                    <Link
                      to="/signin"
                      className="flex items-center justify-center w-full px-6 py-3 text-base font-medium text-gray-400 hover:text-indigo-400 transition duration-200"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Sign In
                    </Link>
                  </div>
                </div>
              </>
            )}

            <p className="text-center text-xs text-gray-500 mt-6">
              🔒 Secure password recovery powered by Lunara
            </p>
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

export default ForgotPassword;
