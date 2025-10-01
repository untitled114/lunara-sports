import { useState, useCallback } from 'react';

const usePromiseModal = () => {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    cancelText: 'Cancel',
    // This resolver function resolves or rejects the promise that the consumer is awaiting
    resolver: null,
  });

  // Function called by the consuming component (e.g., UrgentMessageItem)
  const openModal = useCallback((title, message, confirmText = 'Confirm', cancelText = 'Cancel') => {
    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        resolver: resolve, // Store the promise resolve function
      });
    });
  }, []);

  // Internal handler for when the user confirms or cancels
  const handleResolution = (confirmed) => {
    if (modalState.resolver) {
      modalState.resolver(confirmed); // Resolve the promise with true/false
    }
    setModalState(s => ({ ...s, isOpen: false, resolver: null }));
  };

  return { modalState, openModal, handleResolution };
};

export default usePromiseModal;
