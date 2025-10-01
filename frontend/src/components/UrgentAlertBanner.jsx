import React, { useState } from 'react';
import { useMessageContext } from '../contexts/MessageContext';

const UrgentAlertBanner = () => {
  const { urgentCount } = useMessageContext();
  const [isVisible, setIsVisible] = useState(true);

  // Don't render if no urgent messages or if dismissed
  if (urgentCount === 0 || !isVisible) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="bg-yellow-50 border-b border-yellow-200 py-3 shadow-md"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <span className="text-xl" aria-hidden="true">💬</span>
            <p className="text-sm font-medium text-gray-700">
              <strong>Urgent Messages:</strong> {urgentCount} {urgentCount === 1 ? 'client needs' : 'clients need'} immediate response
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Scroll to urgent messages section
                document.getElementById('urgent-messages')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-3 py-1 text-xs font-semibold text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg transition duration-150 shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
              aria-label={`View ${urgentCount} urgent ${urgentCount === 1 ? 'message' : 'messages'}`}
            >
              Review Now
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="px-2 py-1 text-gray-600 hover:text-gray-800 transition focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 rounded"
              aria-label="Dismiss urgent message alert"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UrgentAlertBanner;
