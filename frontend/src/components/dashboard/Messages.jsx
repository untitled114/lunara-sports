import React from 'react';
import usePromiseModal from '../../hooks/usePromiseModal';
import CustomModal from '../CustomModal';
import UrgentAlertBanner from '../UrgentAlertBanner';
import UrgentMessageList from '../UrgentMessageList';
import { useMessageContext } from '../../contexts/MessageContext';

const Messages = () => {
  const { modalState, openModal, handleResolution } = usePromiseModal();
  const { unreadCount, urgentCount } = useMessageContext();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Custom Modal */}
      <CustomModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        onConfirm={() => handleResolution(true)}
        onCancel={() => handleResolution(false)}
      />

      {/* Urgent Message Alert Banner */}
      <UrgentAlertBanner />

      <main className="pt-6 sm:pt-8 pb-12">
        <section>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Welcome Card */}
            <div className="bg-indigo-600 text-white rounded-xl shadow-xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
              <div className="max-w-2xl">
                <h1 className="text-3xl sm:text-4xl font-extrabold mb-1">💬 Messages & Communication</h1>
                <p className="text-indigo-200 text-lg mb-4">Manage your client conversations and respond to urgent requests</p>
                <p className="text-indigo-300 text-sm italic">All messages are synced in real-time with notifications</p>
              </div>
              <div className="flex flex-wrap gap-4 mt-6 md:mt-0">
                <div className="text-center p-3 bg-indigo-700/50 rounded-lg shadow-inner">
                  <span className="text-3xl font-bold block">{urgentCount}</span>
                  <span className="block text-indigo-200 text-sm">Urgent</span>
                </div>
                <div className="text-center p-3 bg-indigo-700/50 rounded-lg shadow-inner">
                  <span className="text-3xl font-bold block">{unreadCount}</span>
                  <span className="block text-indigo-200 text-sm">Unread</span>
                </div>
                <div className="text-center p-3 bg-indigo-700/50 rounded-lg shadow-inner">
                  <span className="text-3xl font-bold block">12</span>
                  <span className="block text-indigo-200 text-sm">Total Today</span>
                </div>
              </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2">
                {/* Urgent Messages Widget */}
                <UrgentMessageList openModal={openModal} />
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-1 mt-8 lg:mt-0 space-y-8">
                {/* Message Stats */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-100 pb-3">📊 Message Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Today's Messages</span>
                      <span className="font-bold text-yellow-600">12</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Unread</span>
                      <span className="font-bold text-red-600">{unreadCount}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Response Time Avg</span>
                      <span className="font-bold text-green-600">2.3h</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Active Conversations</span>
                      <span className="font-bold text-indigo-600">5</span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-100 pb-3">⚡ Quick Message Actions</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button className="flex flex-col items-center justify-center p-4 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition duration-150 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                      <div className="text-2xl mb-1">📧</div>
                      <span className="text-sm font-medium">Reply to All</span>
                      <small className="text-xs">({unreadCount} unread)</small>
                    </button>
                    <button className="flex flex-col items-center justify-center p-4 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition duration-150 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <div className="text-2xl mb-1">📣</div>
                      <span className="text-sm font-medium">Send Update</span>
                      <small className="text-xs">(All clients)</small>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Messages;
