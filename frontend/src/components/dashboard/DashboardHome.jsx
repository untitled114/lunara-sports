import React from 'react';
import usePromiseModal from '../../hooks/usePromiseModal';
import CustomModal from '../CustomModal';

const DashboardHome = () => {
  const { modalState, openModal, handleResolution } = usePromiseModal();

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
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">🔥 Needs Your Attention</h2>
                  <span className="text-sm font-semibold text-red-600 bg-red-50 px-3 py-1 rounded-full">
                    4 urgent items
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between hover:shadow-md transition">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">💸</div>
                      <div>
                        <div className="font-semibold text-gray-800">TechFlow payment is 3 days overdue</div>
                        <div className="text-sm text-gray-600">$2,400 milestone • Auto-release in 4 days</div>
                      </div>
                    </div>
                    <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-semibold">
                      Chase Payment
                    </button>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between hover:shadow-md transition">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">⏰</div>
                      <div>
                        <div className="font-semibold text-gray-800">HealthApp UI mockups due in 6 hours</div>
                        <div className="text-sm text-gray-600">Client expecting preview tonight</div>
                      </div>
                    </div>
                    <button className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition font-semibold">
                      Work Now
                    </button>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between hover:shadow-md transition">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">💬</div>
                      <div>
                        <div className="font-semibold text-gray-800">Sarah from EcoTech wants scope change</div>
                        <div className="text-sm text-gray-600">Requesting additional API endpoints</div>
                      </div>
                    </div>
                    <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition font-semibold">
                      Discuss
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Projects Widget */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">Projects in Progress</h2>
                </div>

                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📋</div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">No Active Projects</h3>
                  <p className="text-gray-600 mb-6">Create your first project to start collaborating with clients or freelancers.</p>
                  <button className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition font-semibold">
                    Create First Project
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* This Week's Reality Check */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">This Week's Reality</h3>
                <div className="text-4xl font-bold text-green-600 mb-2">$3,200</div>
                <div className="text-sm text-red-600 mb-4">Behind target by $800</div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Invoiced & Paid</span>
                    <span className="font-semibold text-green-600">$1,800</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Work Done, Unpaid</span>
                    <span className="font-semibold text-yellow-600">$2,400</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Coffee & Expenses</span>
                    <span className="font-semibold text-red-600">-$127</span>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Weekly Goal: $4,000</span>
                    <span className="font-semibold">80%</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2">
                    <div className="bg-indigo-600 rounded-full h-2" style={{ width: '80%' }}></div>
                  </div>
                </div>
              </div>

              {/* Client Pulse Check */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Client Pulse Check</h3>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <img
                      src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face"
                      alt="Sarah - EcoTech"
                      className="w-10 h-10 rounded-full"
                      crossOrigin="anonymous"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">Sarah K. (EcoTech)</div>
                      <div className="text-sm text-green-600">😊 Happy - paid early</div>
                    </div>
                    <div className="text-lg font-bold text-green-600">9.2</div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                    <img
                      src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face"
                      alt="Dr. Martinez"
                      className="w-10 h-10 rounded-full"
                      crossOrigin="anonymous"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">Dr. Martinez (HealthTech)</div>
                      <div className="text-sm text-yellow-600">😐 Neutral - deadline stress</div>
                    </div>
                    <div className="text-lg font-bold text-yellow-600">7.1</div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                    <img
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face"
                      alt="Mike - TechFlow"
                      className="w-10 h-10 rounded-full"
                      crossOrigin="anonymous"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">Mike R. (TechFlow)</div>
                      <div className="text-sm text-red-600">😤 Avoiding payments</div>
                    </div>
                    <div className="text-lg font-bold text-red-600">3.8</div>
                  </div>
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
