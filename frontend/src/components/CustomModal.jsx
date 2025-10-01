import React, { useEffect, useRef } from 'react';

const CustomModal = ({ isOpen, title, message, confirmText, cancelText, onConfirm, onCancel }) => {
  const modalRef = useRef(null);
  const confirmButtonRef = useRef(null);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle ESC key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  // Focus trapping and auto-focus on confirm button
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    // Auto-focus on confirm button when modal opens
    if (confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }

    // Focus trap implementation
    const handleTabKey = (e) => {
      if (e.key !== 'Tab') return;

      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // If shift+tab on first element, focus last element
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
      // If tab on last element, focus first element
      else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <div
        ref={modalRef}
        className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full transform transition-all animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="border-b border-gray-700 px-6 py-4">
          <h3 id="modal-title" className="text-xl font-bold text-white">{title}</h3>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-6">
          <p id="modal-description" className="text-gray-300 text-base leading-relaxed whitespace-pre-wrap">{message}</p>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-900/50 rounded-b-2xl">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 text-sm font-semibold text-gray-300 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 hover:border-gray-500 active:bg-gray-600/80 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            {cancelText || 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            ref={confirmButtonRef}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-all duration-150 shadow-lg shadow-indigo-600/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomModal;
