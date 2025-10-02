import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * OfflineBanner Component
 * Displays a banner when the user is offline and dismisses when back online
 */
const OfflineBanner = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);

      // Show reconnected message briefly
      if (wasOffline) {
        setShowReconnected(true);
        setTimeout(() => {
          setShowReconnected(false);
          setWasOffline(false);
        }, 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  // Don't render anything if online and not showing reconnected message
  if (isOnline && !showReconnected) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 text-center font-medium animate-slideDown ${
        showReconnected
          ? 'bg-green-600 text-white'
          : 'bg-red-600 text-white'
      }`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center justify-center gap-2">
        {showReconnected ? (
          <>
            <Wifi className="w-5 h-5" />
            <span>You're back online!</span>
          </>
        ) : (
          <>
            <WifiOff className="w-5 h-5" />
            <span>No internet connection. Some features may not work.</span>
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineBanner;
