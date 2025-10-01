import React from 'react';
import { useMessageContext } from '../contexts/MessageContext';
import UrgentMessageItem from './UrgentMessageItem';

const UrgentMessageList = ({ openModal }) => {
  const { urgentMessages, urgentCount } = useMessageContext();

  return (
    <section
      id="urgent-messages"
      className="bg-white rounded-xl shadow-lg p-6"
      aria-labelledby="urgent-messages-heading"
    >
      <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
        <h2 id="urgent-messages-heading" className="text-xl font-semibold text-gray-800">
          🚨 Urgent Messages
        </h2>
        <span
          className="text-sm font-medium text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-200"
          aria-label={`${urgentCount} urgent ${urgentCount === 1 ? 'message' : 'messages'}`}
        >
          {urgentCount} need responses
        </span>
      </div>

      {urgentMessages.length === 0 ? (
        // Empty State
        <div className="text-center py-12" role="status">
          <div className="text-6xl mb-4" aria-hidden="true">✅</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">All Caught Up!</h3>
          <p className="text-gray-600">No urgent messages at the moment. Great work!</p>
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
