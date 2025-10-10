import React from 'react';
import { Link } from 'react-router-dom';
import { Rocket, FileText, Scale, Shield, AlertCircle } from 'lucide-react';

const Terms = () => {
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
              className="px-4 py-1.5 text-sm font-semibold text-gray-300 hover:text-white transition duration-200"
            >
              Sign In
            </Link>
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
      <main className="flex-grow py-24 mt-16 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-full shadow-lg mb-5">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
              Terms of Service
            </h1>
            <p className="text-gray-400 text-lg">
              Last updated: January 2025
            </p>
          </div>

          {/* Terms Content Card */}
          <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-indigo-500/20 rounded-2xl shadow-lg p-8 md:p-12 space-y-8">
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-600 to-indigo-400" />

            {/* Important Notice */}
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-6 flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-bold text-yellow-300 mb-2">Important Notice</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  By accessing and using Lunara's platform, you agree to be bound by these Terms of Service. Please read them carefully before creating an account.
                </p>
              </div>
            </div>

            {/* Section 1 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Scale className="w-6 h-6 text-indigo-400" />
                <h2 className="text-2xl font-bold text-white">1. Acceptance of Terms</h2>
              </div>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  Welcome to Lunara. By accessing or using our platform, you agree to comply with and be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use our services.
                </p>
                <p>
                  These Terms apply to all users, including freelancers, clients, and visitors. We reserve the right to update these Terms at any time, and your continued use of the platform constitutes acceptance of any changes.
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-indigo-400" />
                <h2 className="text-2xl font-bold text-white">2. Account Responsibilities</h2>
              </div>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide accurate and complete information during registration</li>
                  <li>Keep your account information up to date</li>
                  <li>Immediately notify us of any unauthorized use of your account</li>
                  <li>Not share your account with others</li>
                  <li>Not create multiple accounts without authorization</li>
                </ul>
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. Platform Services</h2>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  Lunara provides a secure platform for freelancers and clients to collaborate on projects. Our services include:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Stripe-verified escrow account management</li>
                  <li>Real-time messaging powered by Ably</li>
                  <li>HD video conferencing via 100ms integration</li>
                  <li>Project management and milestone tracking</li>
                  <li>Payment processing and dispute resolution</li>
                </ul>
                <p>
                  We reserve the right to modify, suspend, or discontinue any part of our services at any time with or without notice.
                </p>
              </div>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Payment Terms</h2>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  All payments are processed through Stripe Connect. By using our platform, you agree to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Pay all applicable fees and charges in a timely manner</li>
                  <li>Provide valid payment information</li>
                  <li>Comply with Stripe's Terms of Service</li>
                  <li>Accept our platform fee structure as outlined in the Pricing section</li>
                </ul>
                <p>
                  Funds placed in escrow are held securely until milestone completion and client approval. Unauthorized chargebacks may result in account suspension.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. User Conduct</h2>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  You agree not to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Use the platform for any illegal or unauthorized purpose</li>
                  <li>Violate any laws in your jurisdiction</li>
                  <li>Infringe upon the rights of others</li>
                  <li>Transmit malicious code or viruses</li>
                  <li>Attempt to gain unauthorized access to our systems</li>
                  <li>Harass, abuse, or harm other users</li>
                  <li>Engage in fraudulent activity</li>
                </ul>
              </div>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Dispute Resolution</h2>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  In the event of a dispute between users, Lunara provides mediation services. All disputes must be reported through our platform's dispute resolution system. We reserve the right to make final decisions on disputes, including fund distribution from escrow accounts.
                </p>
                <p>
                  Any claims or disputes arising from these Terms or your use of Lunara shall be governed by the laws of the jurisdiction in which Lunara is registered.
                </p>
              </div>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">7. Limitation of Liability</h2>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  Lunara is provided "as is" without warranties of any kind. We are not liable for:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Any indirect, incidental, or consequential damages</li>
                  <li>Loss of profits, data, or business opportunities</li>
                  <li>Errors or interruptions in service</li>
                  <li>Actions or conduct of third-party service providers</li>
                </ul>
                <p>
                  Our total liability shall not exceed the amount of fees you paid to Lunara in the past 12 months.
                </p>
              </div>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">8. Termination</h2>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  We reserve the right to suspend or terminate your account at any time for violations of these Terms, suspicious activity, or for any other reason we deem necessary to protect the integrity of our platform.
                </p>
                <p>
                  You may terminate your account at any time by contacting support. Upon termination, all outstanding payments and obligations must be settled.
                </p>
              </div>
            </section>

            {/* Contact Section */}
            <div className="pt-8 border-t border-gray-700/50">
              <h2 className="text-2xl font-bold text-white mb-4">Contact Us</h2>
              <p className="text-gray-300 leading-relaxed">
                If you have any questions about these Terms of Service, please contact us at{' '}
                <a href="mailto:legal@lunara.com" className="text-indigo-400 hover:text-indigo-300 transition duration-200 font-semibold">
                  legal@lunara.com
                </a>
              </p>
            </div>

            {/* Back to Sign Up */}
            <div className="pt-6 border-t border-gray-700/50">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/privacy"
                  className="px-6 py-3 text-base font-semibold text-indigo-300 border-2 border-indigo-500/30 rounded-xl hover:bg-indigo-500/10 hover:border-indigo-400 transition-all duration-300 text-center"
                >
                  Read Privacy Policy
                </Link>
                <Link
                  to="/signup"
                  className="px-6 py-3 text-base font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl hover:from-indigo-500 hover:to-indigo-400 transition-all duration-300 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 text-center"
                >
                  Accept & Sign Up
                </Link>
              </div>
            </div>
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

export default Terms;
