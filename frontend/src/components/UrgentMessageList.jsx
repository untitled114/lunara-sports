import React from 'react';
import { useMessageContext } from '../contexts/MessageContext';
import UrgentMessageItem from './UrgentMessageItem';

const UrgentMessageList = ({ openModal }) => {
  const { urgentMessages, urgentCount } = useMessageContext();

  return (
    <section
      id="urgent-messages"
      className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-6"
      aria-labelledby="urgent-messages-heading"
    >
      <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-3">
        <h2 id="urgent-messages-heading" className="text-xl font-semibold text-white">
          🚨 Urgent Messages
        </h2>
        <span
          className="text-sm font-medium text-red-300 bg-red-900/30 border border-red-500/30 px-3 py-1 rounded-full"
          aria-label={`${urgentCount} urgent ${urgentCount === 1 ? 'message' : 'messages'}`}
        >
          {urgentCount} need responses
        </span>
      </div>

      {urgentMessages.length === 0 ? (
        // Empty State
        <div className="text-center py-12" role="status">
          <div className="text-6xl mb-4" aria-hidden="true">✅</div>
          <h3 className="text-xl font-semibold text-white mb-2">All Caught Up!</h3>
          <p className="text-gray-400">No urgent messages at the moment. Great work!</p>
        </div>
      ) : (
        // Urgent Messages List
        <ul className="space-y-4" role="list">
          {urgentMessages.map((message) => (
            <UrgentMessageItem
              key={message.id}
              message={message}
              openModal={openModal}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

export default UrgentMessageList;
