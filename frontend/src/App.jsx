import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Context Providers
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { MessageProvider } from './contexts/MessageContext';

// Components
import ToastContainer from './components/ToastContainer';
import ProtectedRoute from './components/ProtectedRoute';

// Landing page components
import Navigation from './components/Navigation';
import Particles from './components/Particles';
import Hero from './components/Hero';
import Features from './components/Features';
import HowItWorks from './components/How-it-works';
import Pricing from './components/Pricing';

// Auth components
import SignIn from './components/SignIn';
import SignUp from './components/SignUp';

// Dashboard components
import DashboardLayout from './components/dashboard/DashboardLayout';
import DashboardHome from './components/dashboard/DashboardHome';
import Messages from './components/dashboard/Messages';
import Projects from './components/dashboard/Projects';
import Payments from './components/dashboard/Payments';
import Profile from './components/dashboard/Profile';

// Landing Page
const LandingPage = () => (
  <>
    <Navigation />
    <Particles />
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
            <Routes>
              {/* Landing Page */}
              <Route path="/" element={<LandingPage />} />

              {/* Auth Routes */}
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />

              {/* Protected Dashboard Routes */}
              <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route path="dashboard" element={<DashboardHome />} />
                <Route path="messages" element={<Messages />} />
                <Route path="projects" element={<Projects />} />
                <Route path="payments" element={<Payments />} />
                <Route path="profile" element={<Profile />} />
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
