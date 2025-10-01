import React from 'react';
import { useMessageContext } from '../contexts/MessageContext';
import { useToast } from '../contexts/ToastContext';

const UrgentMessageItem = ({ message, openModal }) => {
  const { updateMessageStatus } = useMessageContext();
  const { showSuccess, showError } = useToast();

  // Determine urgency styling
  const getUrgencyClass = (score) => {
    if (score >= 90) return 'bg-red-50 border-red-200';
    if (score >= 75) return 'bg-yellow-50 border-yellow-200';
    return 'bg-blue-50 border-blue-200';
  };

  const getButtonClass = (score) => {
    if (score >= 90) return 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
    if (score >= 75) return 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500';
    return 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500';
  };

  const getIconEmoji = (score) => {
    if (score >= 90) return '📱';
    if (score >= 75) return '💸';
    return '🔧';
  };

  // Handle reply action with modal confirmation
  const handleReply = async () => {
    const confirmed = await openModal(
      'Confirm Reply',
      `Send reply to ${message.clientName} about "${message.project}"?\n\n"${message.summary}"`,
      'Send Message',
      'Cancel'
    );

    if (confirmed) {
      try {
        // Update message status in context
        await updateMessageStatus(message.id, { isReplied: true });

        // Show success toast
        showSuccess(`Message sent to ${message.clientName}!`);
      } catch (error) {
        // Show error toast
        showError('Failed to send message');
      }
    }
  };

  return (
    <li
      className={`p-4 rounded-lg border flex items-center justify-between hover:shadow-md transition duration-200 ${getUrgencyClass(message.urgencyScore)}`}
    >
      <div className="flex items-center space-x-3 flex-1">
        <div className="text-2xl" aria-hidden="true">{getIconEmoji(message.urgencyScore)}</div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-800 truncate">
            {message.clientName} ({message.project})
          </div>
          <div className="text-xs text-gray-600 line-clamp-2">{message.summary}</div>
        </div>
      </div>
      <button
        onClick={handleReply}
        className={`px-3 py-1.5 text-sm font-semibold text-white rounded-lg shadow-md transition duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 whitespace-nowrap ml-3 ${getButtonClass(message.urgencyScore)}`}
        aria-label={`Reply to ${message.clientName}`}
      >
        Reply
      </button>
    </li>
  );
};

export default UrgentMessageItem;
