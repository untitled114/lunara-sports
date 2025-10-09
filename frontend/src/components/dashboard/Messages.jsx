import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import usePromiseModal from '../../hooks/usePromiseModal';
import CustomModal from '../CustomModal';
import UrgentAlertBanner from '../UrgentAlertBanner';
import UrgentMessageList from '../UrgentMessageList';
import { useMessageContext } from '../../contexts/MessageContext';
import { useToast } from '../../contexts/ToastContext';
import { messagesAPI } from '../../services/api';

const Messages = () => {
  const { modalState, openModal, handleResolution } = usePromiseModal();
  const { unreadCount, urgentCount } = useMessageContext();
  const { showSuccess, showError, showInfo } = useToast();

  const [messageForm, setMessageForm] = useState({
    to: '',
    message: '',
  });
  const [sending, setSending] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setMessageForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!messageForm.to || !messageForm.message) {
      showError('Please fill in both recipient and message');
      return;
    }

    setSending(true);

    try {
      await messagesAPI.send({
        recipient: messageForm.to,
        subject: 'New Message',
        content: messageForm.message,
      });

      showSuccess(`Message sent to ${messageForm.to}!`);

      // Clear form
      setMessageForm({
        to: '',
        message: '',
      });

    } catch (error) {
      console.error('Send message error:', error);

      // Handle 404 - backend endpoint not yet implemented
      if (error.status === 404) {
        showInfo('Messaging feature coming soon! Backend API is in development.');
        // Clear form as if sent (for demo purposes)
        setMessageForm({ to: '', message: '' });
        return;
      }

      let errorMessage = 'Failed to send message. Please try again.';
      if (error.data && error.data.message) {
        errorMessage = error.data.message;
      } else if (error.isNetworkError) {
        errorMessage = 'Network error. Please check your connection.';
      }
      showError(errorMessage);
    } finally {
      setSending(false);
    }
  };

  const handleReplyToAll = async () => {
    try {
      await messagesAPI.batchReply({
        message: 'Thank you for your message. I will respond shortly.',
      });
      showSuccess(`Batch reply sent to ${unreadCount} unread messages!`);
    } catch (error) {
      console.error('Batch reply error:', error);

      // Handle 404 - backend endpoint not yet implemented
      if (error.status === 404) {
        showInfo('Batch reply feature coming soon! Backend API is in development.');
        return;
      }

      showError('Failed to send batch replies. Please try again.');
    }
  };

  const handleSendUpdate = async () => {
    try {
      await messagesAPI.broadcast({
        subject: 'Project Update',
        content: 'Sending update to all clients...',
      });
      showSuccess('Broadcast message sent to all clients!');
    } catch (error) {
      console.error('Broadcast error:', error);

      // Handle 404 - backend endpoint not yet implemented
      if (error.status === 404) {
        showInfo('Broadcast feature coming soon! Backend API is in development.');
        return;
      }

      showError('Failed to send broadcast. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
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
            <div className="bg-indigo-600 text-white rounded-xl shadow-xl p-4 sm:p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center mb-6 sm:mb-8 gap-4 md:gap-6">
              <div className="w-full md:max-w-2xl">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-1 sm:mb-2">💬 Messages & Communication</h1>
                <p className="text-indigo-200 text-base sm:text-lg mb-3 sm:mb-4">Manage your client conversations and respond to urgent requests</p>
                <p className="text-indigo-300 text-xs sm:text-sm italic">All messages are synced in real-time with notifications</p>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-4 w-full md:w-auto">
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

            {/* Widgets - Full Width Responsive Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                {/* Message Stats */}
                <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-indigo-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
                  {/* Top Accent Line */}
                  <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-600 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <h3 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-3">📊 Message Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Today's Messages</span>
                      <span className="font-bold text-yellow-400">12</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Unread</span>
                      <span className="font-bold text-red-400">{unreadCount}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Response Time Avg</span>
                      <span className="font-bold text-green-400">2.3h</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Active Conversations</span>
                      <span className="font-bold text-indigo-400">5</span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-purple-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-purple-500/20 hover:border-purple-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
                  {/* Top Accent Line */}
                  <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-purple-600 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <h3 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-3">⚡ Quick Message Actions</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={handleReplyToAll}
                      className="flex flex-col items-center justify-center p-4 bg-red-900/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-900/30 transition duration-150 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <div className="text-2xl mb-1">📧</div>
                      <span className="text-sm font-medium">Reply to All</span>
                      <small className="text-xs text-gray-400">({unreadCount} unread)</small>
                    </button>
                    <button
                      onClick={handleSendUpdate}
                      className="flex flex-col items-center justify-center p-4 bg-indigo-900/20 text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-900/30 transition duration-150 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <div className="text-2xl mb-1">📣</div>
                      <span className="text-sm font-medium">Send Update</span>
                      <small className="text-xs text-gray-400">(All clients)</small>
                    </button>
                  </div>
                </div>

                {/* Compose New Message */}
                <div className="group relative bg-gradient-to-br from-purple-900/30 to-indigo-900/30 backdrop-blur-sm border border-purple-500/30 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-purple-500/20 hover:border-purple-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
                  {/* Top Accent Line */}
                  <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-purple-600 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <h3 className="text-lg font-semibold text-white mb-4 border-b border-purple-500/30 pb-3">✉️ Compose New Message</h3>
                  <form onSubmit={handleSendMessage} className="space-y-4">
                    <div>
                      <label htmlFor="to" className="block text-sm font-medium text-gray-300 mb-2">To</label>
                      <input
                        type="text"
                        id="to"
                        name="to"
                        value={messageForm.to}
                        onChange={handleInputChange}
                        placeholder="Select client or project..."
                        className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                      <textarea
                        id="message"
                        name="message"
                        value={messageForm.message}
                        onChange={handleInputChange}
                        rows="3"
                        placeholder="Type your message..."
                        className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition text-sm resize-none"
                      ></textarea>
                    </div>
                    <button
                      type="submit"
                      disabled={sending}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-2.5 rounded-lg font-semibold shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all flex items-center justify-center gap-2 disabled:from-purple-400 disabled:to-indigo-400 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <span>Send Message</span>
                          <span className="text-lg">→</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
            </div>

            {/* Urgent Messages List - Full Width */}
            <UrgentMessageList openModal={openModal} />
          </div>
        </section>
      </main>
    </div>
  );
};

export default Messages;
