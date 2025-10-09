import React from 'react';
import { useMessageContext } from '../contexts/MessageContext';
import UrgentMessageItem from './UrgentMessageItem';

const UrgentMessageList = ({ openModal }) => {
  const { urgentMessages, urgentCount } = useMessageContext();

  return (
    <section
      id="urgent-messages"
      className="group relative bg-gray-800/50 backdrop-blur-sm border border-red-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-red-500/20 hover:border-red-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6"
      aria-labelledby="urgent-messages-heading"
    >
      {/* Top Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-red-600 to-red-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

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
