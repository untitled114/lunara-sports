import React from 'react';
import { X, CheckCircle, AlertCircle, Info, Clock } from 'lucide-react';

const NotificationsModal = ({ isOpen, onClose, notifications = [] }) => {
  if (!isOpen) return null;

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'urgent':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-indigo-400" />;
    }
  };

  const getNotificationStyle = (type) => {
    switch (type) {
      case 'success':
        return 'border-green-500/30 bg-green-900/20';
      case 'warning':
        return 'border-yellow-500/30 bg-yellow-900/20';
      case 'error':
        return 'border-red-500/30 bg-red-900/20';
      case 'urgent':
        return 'border-red-600/50 bg-red-900/30';
      default:
        return 'border-indigo-500/30 bg-indigo-900/20';
    }
  };

  // Sample notifications if none provided
  const sampleNotifications = [
    {
      id: 1,
      type: 'urgent',
      title: 'Payment Overdue',
      message: 'TechFlow milestone payment is 3 days late. Automatic escrow release in 4 days.',
      time: '10 minutes ago',
      unread: true,
    },
    {
      id: 2,
      type: 'success',
      title: 'Payment Received',
      message: 'MedCare Plus paid $3,800 for Healthcare Portal milestone.',
      time: '2 hours ago',
      unread: true,
    },
    {
      id: 3,
      type: 'info',
      title: 'New Message',
      message: 'Sarah from StartupX sent you a message about the project timeline.',
      time: '5 hours ago',
      unread: false,
    },
    {
      id: 4,
      type: 'warning',
      title: 'Project Deadline Approaching',
      message: 'E-commerce Dashboard milestone due in 2 days.',
      time: '1 day ago',
      unread: false,
    },
  ];

  const displayNotifications = notifications.length > 0 ? notifications : sampleNotifications;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fadeIn"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="fixed right-4 top-20 w-full max-w-md bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 animate-slideInRight overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Notifications</h2>
            <p className="text-sm text-indigo-100">
              {displayNotifications.filter(n => n.unread).length} unread
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition duration-200"
            aria-label="Close notifications"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Notifications List */}
        <div className="max-h-[600px] overflow-y-auto">
          {displayNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🔔</div>
              <h3 className="text-xl font-bold text-white mb-2">No Notifications</h3>
              <p className="text-gray-400">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700/50">
              {displayNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-700/30 transition duration-200 cursor-pointer border-l-4 ${getNotificationStyle(notification.type)} ${
                    notification.unread ? 'bg-gray-700/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-white">
                          {notification.title}
                          {notification.unread && (
                            <span className="ml-2 inline-block w-2 h-2 bg-indigo-500 rounded-full"></span>
                          )}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-300 mt-1 leading-relaxed">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{notification.time}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-700 p-3 bg-gray-800/50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-indigo-300 hover:text-indigo-200 hover:bg-gray-700/50 rounded-lg transition duration-200"
          >
            Mark all as read
          </button>
        </div>
      </div>
    </>
  );
};

export default NotificationsModal;
