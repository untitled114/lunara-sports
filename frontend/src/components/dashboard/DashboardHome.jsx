import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePromiseModal from '../../hooks/usePromiseModal';
import CustomModal from '../CustomModal';
import NewProjectModal from '../NewProjectModal';
import { useToast } from '../../contexts/ToastContext';

const DashboardHome = () => {
  const navigate = useNavigate();
  const { showSuccess, showInfo, showError } = useToast();
  const { modalState, openModal, handleResolution } = usePromiseModal();
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  // Demo function showing how to use the promise-based modal
  const handleTestModal = async () => {
    const confirmed = await openModal(
      'Test Confirmation',
      'This is a demonstration of the promise-based modal system. The code will wait for your response before proceeding.',
      'Yes, I Understand',
      'Cancel'
    );

    if (confirmed) {
      alert('✅ You clicked Confirm! The promise resolved to TRUE.');
    } else {
      alert('❌ You clicked Cancel. The promise resolved to FALSE.');
    }
  };

  // Urgent Actions Handlers
  const handleChasePayment = () => {
    showInfo('Sending payment reminder to client...');
    // TODO: Implement payment reminder API call
    setTimeout(() => {
      showSuccess('Payment reminder sent successfully!');
    }, 1500);
  };

  const handleWorkNow = () => {
    showInfo('Redirecting to project workspace...');
    // TODO: Navigate to specific project
    setTimeout(() => {
      navigate('/projects');
    }, 800);
  };

  const handleDiscuss = () => {
    showInfo('Opening chat with client...');
    setTimeout(() => {
      navigate('/messages');
    }, 800);
  };

  const handleCreateFirstProject = () => {
    setIsProjectModalOpen(true);
  };

  // Quick Actions Handlers
  const handleNewProject = () => {
    setIsProjectModalOpen(true);
  };

  const handleSendMessage = () => {
    navigate('/messages');
  };

  const handleRequestPayout = () => {
    showInfo('Payout request modal coming soon!');
    // TODO: Implement payout modal
  };

  const handleViewReports = () => {
    showInfo('Analytics & Reports page coming soon!');
    // TODO: Navigate to reports page
  };

  return (
    <div className="dashboard-main">
      {/* Custom Modal Component */}
      <CustomModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        onConfirm={() => handleResolution(true)}
        onCancel={() => handleResolution(false)}
      />

      {/* New Project Modal */}
      <NewProjectModal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} />

      {/* Hero Welcome Section */}
      <section className="dashboard-hero bg-gradient-to-br from-indigo-600 to-purple-700 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="welcome-card flex flex-col md:flex-row justify-between items-center">
            <div className="welcome-content mb-6 md:mb-0">
              <h1 id="dashboard-greeting" className="text-4xl font-bold mb-2">
                Welcome to Lunara Dashboard ⚡
              </h1>
              <p className="text-lg opacity-90">You've got 3 client check-ins today and a milestone deadline tonight</p>
              <span className="text-sm opacity-75 mt-2 block">
                Last active: <time dateTime="2024-12-15T14:23:00">2 hours ago from Coffee Bean WiFi</time>
              </span>
              <button
                onClick={handleTestModal}
                className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-semibold transition-all"
              >
                🧪 Test Promise Modal
              </button>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-4">
              <div className="text-center bg-white/10 backdrop-blur-sm rounded-lg p-4 min-w-[100px]">
                <span className="text-3xl font-bold block">-</span>
                <span className="text-sm opacity-75">Overdue</span>
              </div>
              <div className="text-center bg-white/10 backdrop-blur-sm rounded-lg p-4 min-w-[100px]">
                <span className="text-3xl font-bold block">-</span>
                <span className="text-sm opacity-75">Due Today</span>
              </div>
              <div className="text-center bg-white/10 backdrop-blur-sm rounded-lg p-4 min-w-[100px]">
                <span className="text-3xl font-bold block">-</span>
                <span className="text-sm opacity-75">Week Progress</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Dashboard Content */}
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content Area */}
            <div className="lg:col-span-2 space-y-6">
              {/* Urgent Actions Widget */}
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-white">🔥 Needs Your Attention</h2>
                  <span className="text-sm font-semibold text-red-300 bg-red-900/30 border border-red-500/30 px-3 py-1 rounded-full">
                    4 urgent items
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 flex items-center justify-between hover:shadow-md hover:shadow-red-500/10 transition">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">💸</div>
                      <div>
                        <div className="font-semibold text-white">TechFlow payment is 3 days overdue</div>
                        <div className="text-sm text-gray-400">$2,400 milestone • Auto-release in 4 days</div>
                      </div>
                    </div>
                    <button
                      onClick={handleChasePayment}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-semibold"
                    >
                      Chase Payment
                    </button>
                  </div>

                  <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 flex items-center justify-between hover:shadow-md hover:shadow-yellow-500/10 transition">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">⏰</div>
                      <div>
                        <div className="font-semibold text-white">HealthApp UI mockups due in 6 hours</div>
                        <div className="text-sm text-gray-400">Client expecting preview tonight</div>
                      </div>
                    </div>
                    <button
                      onClick={handleWorkNow}
                      className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition font-semibold"
                    >
                      Work Now
                    </button>
                  </div>

                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 flex items-center justify-between hover:shadow-md hover:shadow-blue-500/10 transition">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">💬</div>
                      <div>
                        <div className="font-semibold text-white">Sarah from EcoTech wants scope change</div>
                        <div className="text-sm text-gray-400">Requesting additional API endpoints</div>
                      </div>
                    </div>
                    <button
                      onClick={handleDiscuss}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition font-semibold"
                    >
                      Discuss
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Projects Widget */}
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-white">Projects in Progress</h2>
                </div>

                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📋</div>
                  <h3 className="text-xl font-semibold text-white mb-2">No Active Projects</h3>
                  <p className="text-gray-400 mb-6">Create your first project to start collaborating with clients or freelancers.</p>
                  <button
                    onClick={handleCreateFirstProject}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition font-semibold shadow-lg shadow-indigo-500/30"
                  >
                    Create First Project
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* This Week's Reality Check */}
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">This Week's Reality</h3>
                <div className="text-4xl font-bold text-green-400 mb-2">$3,200</div>
                <div className="text-sm text-red-400 mb-4">Behind target by $800</div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Invoiced & Paid</span>
                    <span className="font-semibold text-green-400">$1,800</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Work Done, Unpaid</span>
                    <span className="font-semibold text-yellow-400">$2,400</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Coffee & Expenses</span>
                    <span className="font-semibold text-red-400">-$127</span>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-2 text-gray-300">
                    <span>Weekly Goal: $4,000</span>
                    <span className="font-semibold">80%</span>
                  </div>
                  <div className="bg-gray-700 rounded-full h-2">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full h-2" style={{ width: '80%' }}></div>
                  </div>
                </div>
              </div>

              {/* Client Pulse Check */}
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">Client Pulse Check</h3>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                    <img
                      src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face"
                      alt="Sarah - EcoTech"
                      className="w-10 h-10 rounded-full"
                      crossOrigin="anonymous"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-white">Sarah K. (EcoTech)</div>
                      <div className="text-sm text-green-400">😊 Happy - paid early</div>
                    </div>
                    <div className="text-lg font-bold text-green-400">9.2</div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                    <img
                      src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face"
                      alt="Dr. Martinez"
                      className="w-10 h-10 rounded-full"
                      crossOrigin="anonymous"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-white">Dr. Martinez (HealthTech)</div>
                      <div className="text-sm text-yellow-400">😐 Neutral - deadline stress</div>
                    </div>
                    <div className="text-lg font-bold text-yellow-400">7.1</div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                    <img
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face"
                      alt="Mike - TechFlow"
                      className="w-10 h-10 rounded-full"
                      crossOrigin="anonymous"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-white">Mike R. (TechFlow)</div>
                      <div className="text-sm text-red-400">😤 Avoiding payments</div>
                    </div>
                    <div className="text-lg font-bold text-red-400">3.8</div>
                  </div>
                </div>
              </div>

              {/* Quick Actions Widget */}
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">⚡ Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleNewProject}
                    className="flex flex-col items-center justify-center p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-lg hover:bg-indigo-900/30 hover:shadow-md hover:shadow-indigo-500/10 transition group"
                  >
                    <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">📝</span>
                    <span className="text-sm font-semibold text-indigo-300">New Project</span>
                  </button>
                  <button
                    onClick={handleSendMessage}
                    className="flex flex-col items-center justify-center p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg hover:bg-purple-900/30 hover:shadow-md hover:shadow-purple-500/10 transition group"
                  >
                    <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">💬</span>
                    <span className="text-sm font-semibold text-purple-300">Send Message</span>
                  </button>
                  <button
                    onClick={handleRequestPayout}
                    className="flex flex-col items-center justify-center p-4 bg-green-900/20 border border-green-500/30 rounded-lg hover:bg-green-900/30 hover:shadow-md hover:shadow-green-500/10 transition group"
                  >
                    <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">💰</span>
                    <span className="text-sm font-semibold text-green-300">Request Payout</span>
                  </button>
                  <button
                    onClick={handleViewReports}
                    className="flex flex-col items-center justify-center p-4 bg-cyan-900/20 border border-cyan-500/30 rounded-lg hover:bg-cyan-900/30 hover:shadow-md hover:shadow-cyan-500/10 transition group"
                  >
                    <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">📊</span>
                    <span className="text-sm font-semibold text-cyan-300">View Reports</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardHome;
