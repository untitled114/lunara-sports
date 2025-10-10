import React from 'react';
import { Link } from 'react-router-dom';
import { Rocket, ShieldCheck, Eye, Lock, Database, Cookie, AlertCircle } from 'lucide-react';

const Privacy = () => {
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
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-600 to-green-500 rounded-full shadow-lg mb-5">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
              Privacy Policy
            </h1>
            <p className="text-gray-400 text-lg">
              Last updated: January 2025
            </p>
          </div>

          {/* Privacy Content Card */}
          <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-green-500/20 rounded-2xl shadow-lg p-8 md:p-12 space-y-8">
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-green-600 to-green-400" />

            {/* Important Notice */}
            <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6 flex items-start gap-4">
              <Lock className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-bold text-green-300 mb-2">Your Privacy Matters</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  At Lunara, we take your privacy seriously. This policy explains how we collect, use, and protect your personal information when you use our platform.
                </p>
              </div>
            </div>

            {/* Section 1 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-6 h-6 text-green-400" />
                <h2 className="text-2xl font-bold text-white">1. Information We Collect</h2>
              </div>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  We collect information that you provide directly to us, including:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Account Information:</strong> Name, email address, password, and profile details</li>
                  <li><strong>Payment Information:</strong> Payment methods and billing details (processed securely through Stripe)</li>
                  <li><strong>Project Data:</strong> Project descriptions, milestones, messages, and files you share</li>
                  <li><strong>Communication Data:</strong> Messages, video call metadata, and support inquiries</li>
                  <li><strong>Usage Data:</strong> How you interact with our platform, including IP address, browser type, and device information</li>
                </ul>
              </div>
            </section>

            {/* Section 2 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Eye className="w-6 h-6 text-green-400" />
                <h2 className="text-2xl font-bold text-white">2. How We Use Your Information</h2>
              </div>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  We use the information we collect to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide, maintain, and improve our services</li>
                  <li>Process payments and manage escrow accounts</li>
                  <li>Facilitate communication between clients and freelancers</li>
                  <li>Send important notifications and updates about your account</li>
                  <li>Detect and prevent fraud, abuse, and security incidents</li>
                  <li>Comply with legal obligations and enforce our Terms of Service</li>
                  <li>Analyze usage patterns to enhance user experience</li>
                </ul>
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. Information Sharing</h2>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  We do not sell your personal information. We may share your information with:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Service Providers:</strong> Trusted partners like Stripe (payments), Ably (messaging), and 100ms (video) who help us operate our platform</li>
                  <li><strong>Other Users:</strong> Your profile information and project-related data with users you interact with on the platform</li>
                  <li><strong>Legal Authorities:</strong> When required by law or to protect our rights and users' safety</li>
                  <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                </ul>
                <p>
                  All third-party service providers are contractually obligated to protect your data and use it only for the purposes we specify.
                </p>
              </div>
            </section>

            {/* Section 4 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Lock className="w-6 h-6 text-green-400" />
                <h2 className="text-2xl font-bold text-white">4. Data Security</h2>
              </div>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  We implement industry-standard security measures to protect your information:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>End-to-end encryption for sensitive data</li>
                  <li>Secure HTTPS connections for all data transmission</li>
                  <li>Regular security audits and penetration testing</li>
                  <li>Strict access controls and employee confidentiality agreements</li>
                  <li>Automatic logout after periods of inactivity</li>
                  <li>Multi-factor authentication options</li>
                </ul>
                <p>
                  While we strive to protect your data, no method of transmission over the internet is 100% secure. You are responsible for maintaining the confidentiality of your account credentials.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Cookie className="w-6 h-6 text-green-400" />
                <h2 className="text-2xl font-bold text-white">5. Cookies & Tracking</h2>
              </div>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  We use cookies and similar tracking technologies to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Remember your preferences and settings</li>
                  <li>Keep you logged in securely</li>
                  <li>Analyze site traffic and usage patterns</li>
                  <li>Improve platform performance</li>
                </ul>
                <p>
                  You can control cookie settings through your browser, but disabling cookies may limit some platform functionality.
                </p>
              </div>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Your Privacy Rights</h2>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  Depending on your location, you may have the following rights:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
                  <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                  <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
                  <li><strong>Portability:</strong> Receive your data in a machine-readable format</li>
                  <li><strong>Objection:</strong> Object to certain data processing activities</li>
                  <li><strong>Restriction:</strong> Request that we limit how we use your data</li>
                </ul>
                <p>
                  To exercise these rights, contact us at{' '}
                  <a href="mailto:privacy@lunara.com" className="text-green-400 hover:text-green-300 transition duration-200 font-semibold">
                    privacy@lunara.com
                  </a>
                </p>
              </div>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">7. Data Retention</h2>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  We retain your personal information for as long as necessary to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide our services and fulfill transactions</li>
                  <li>Comply with legal and regulatory requirements</li>
                  <li>Resolve disputes and enforce our agreements</li>
                  <li>Maintain security and prevent fraud</li>
                </ul>
                <p>
                  When you close your account, we will delete or anonymize your data within 90 days, except where we are required to retain it by law.
                </p>
              </div>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">8. Children's Privacy</h2>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  Lunara is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If we discover that we have collected information from a child under 18, we will delete it immediately.
                </p>
              </div>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">9. International Data Transfers</h2>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your data in accordance with this Privacy Policy and applicable data protection laws.
                </p>
              </div>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">10. Changes to This Policy</h2>
              <div className="text-gray-300 leading-relaxed space-y-3">
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of significant changes by email or through a prominent notice on our platform. Your continued use after changes are posted constitutes acceptance of the updated policy.
                </p>
              </div>
            </section>

            {/* Contact Section */}
            <div className="pt-8 border-t border-gray-700/50">
              <h2 className="text-2xl font-bold text-white mb-4">Contact Us</h2>
              <p className="text-gray-300 leading-relaxed">
                If you have any questions or concerns about this Privacy Policy, please contact us at{' '}
                <a href="mailto:privacy@lunara.com" className="text-green-400 hover:text-green-300 transition duration-200 font-semibold">
                  privacy@lunara.com
                </a>
              </p>
            </div>

            {/* Back to Sign Up */}
            <div className="pt-6 border-t border-gray-700/50">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/terms"
                  className="px-6 py-3 text-base font-semibold text-green-300 border-2 border-green-500/30 rounded-xl hover:bg-green-500/10 hover:border-green-400 transition-all duration-300 text-center"
                >
                  Read Terms of Service
                </Link>
                <Link
                  to="/signup"
                  className="px-6 py-3 text-base font-bold text-white bg-gradient-to-r from-green-600 to-green-500 rounded-xl hover:from-green-500 hover:to-green-400 transition-all duration-300 shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 text-center"
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

export default Privacy;
