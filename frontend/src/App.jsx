import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Context Providers
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { MessageProvider } from './contexts/MessageContext';

// Components
import ToastContainer from './components/ToastContainer';
import ProtectedRoute from './components/ProtectedRoute';
import OfflineBanner from './components/OfflineBanner';

// Landing page components (loaded immediately - users see first)
import Navigation from './components/Navigation';
import Hero from './components/Hero';
import Features from './components/Features';
import HowItWorks from './components/How-it-works';
import Pricing from './components/Pricing';

// Auth components (loaded immediately - high priority)
import SignIn from './components/SignIn';
import SignUp from './components/SignUp';
import ForgotPassword from './components/ForgotPassword';

// Legal pages (loaded immediately)
import Terms from './components/Terms';
import Privacy from './components/Privacy';

// Dashboard components (lazy loaded - code splitting for better performance)
const DashboardLayout = lazy(() => import('./components/dashboard/DashboardLayout'));
const DashboardHome = lazy(() => import('./components/dashboard/DashboardHome'));
const Messages = lazy(() => import('./components/dashboard/Messages'));
const Projects = lazy(() => import('./components/dashboard/Projects'));
const Payments = lazy(() => import('./components/dashboard/Payments'));
const Payouts = lazy(() => import('./components/dashboard/Payouts'));
const Reports = lazy(() => import('./components/dashboard/Reports'));
const Profile = lazy(() => import('./components/dashboard/Profile'));

// Loading component for lazy-loaded routes
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-900">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
      <p className="text-gray-400">Loading...</p>
    </div>
  </div>
);

// Landing Page
const LandingPage = () => (
  <>
    <Navigation />
    <Hero />
    <Features />
    <HowItWorks />
    <Pricing />
  </>
);

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <MessageProvider>
          <Router>
            <OfflineBanner />
            <Routes>
              {/* Landing Page */}
              <Route path="/" element={<LandingPage />} />

              {/* Auth Routes */}
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              {/* Legal Pages */}
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />

              {/* Protected Dashboard Routes - Lazy Loaded */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingFallback />}>
                    <DashboardLayout />
                  </Suspense>
                </ProtectedRoute>
              }>
                <Route path="dashboard" element={
                  <Suspense fallback={<LoadingFallback />}>
                    <DashboardHome />
                  </Suspense>
                } />
                <Route path="messages" element={
                  <Suspense fallback={<LoadingFallback />}>
                    <Messages />
                  </Suspense>
                } />
                <Route path="projects" element={
                  <Suspense fallback={<LoadingFallback />}>
                    <Projects />
                  </Suspense>
                } />
                <Route path="payments" element={
                  <Suspense fallback={<LoadingFallback />}>
                    <Payments />
                  </Suspense>
                } />
                <Route path="payouts" element={
                  <Suspense fallback={<LoadingFallback />}>
                    <Payouts />
                  </Suspense>
                } />
                <Route path="reports" element={
                  <Suspense fallback={<LoadingFallback />}>
                    <Reports />
                  </Suspense>
                } />
                <Route path="profile" element={
                  <Suspense fallback={<LoadingFallback />}>
                    <Profile />
                  </Suspense>
                } />
              </Route>
            </Routes>
          </Router>
          <ToastContainer />
        </MessageProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
