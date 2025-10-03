import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { APP_ID } from '../config/firebase';
import { useToast } from './ToastContext';

// Mock message data as fallback
const initialMessages = [
  {
    id: 'm1',
    clientName: 'Dr. Sarah Martinez',
    project: 'HealthTech Portal',
    timestamp: '2025-10-01T14:30:00Z',
    urgencyScore: 95,
    summary: 'Called twice about tonight\'s UI mockup deadline. Patient portal is critical and needs review ASAP.',
    fullMessage: 'Jordan, just called twice about tonight\'s deadline. Can we push the UI review to tomorrow morning? Patient portal is critical...',
    isReplied: false,
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face'
  },
  {
    id: 'm2',
    clientName: 'Mike R.',
    project: 'TechFlow',
    timestamp: '2025-10-01T12:15:00Z',
    urgencyScore: 88,
    summary: '$2,400 payment overdue - scheduled call at 6:00 PM to discuss payment plan.',
    fullMessage: 'Hey, about that payment... we had some cash flow issues this month. Can we work out a payment plan?',
    isReplied: false,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face'
  },
  {
    id: 'm3',
    clientName: 'Sarah K.',
    project: 'EcoTech',
    timestamp: '2025-10-01T10:45:00Z',
    urgencyScore: 72,
    summary: 'Requesting additional API endpoints for real-time carbon tracking. Needs budget discussion.',
    fullMessage: 'Love the database design! Quick question - can we add API endpoints for real-time carbon tracking? Happy to discuss budget.',
    isReplied: false,
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face'
  },
  {
    id: 'm4',
    clientName: 'Alex Chen',
    project: 'StartupXYZ Branding',
    timestamp: '2025-10-01T09:20:00Z',
    urgencyScore: 45,
    summary: 'Loved the logo concepts! Can we schedule a call next week to discuss Phase 2?',
    fullMessage: 'The brand identity looks amazing! Let\'s schedule time next week to go over Phase 2 deliverables.',
    isReplied: true,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face'
  },
  {
    id: 'm5',
    clientName: 'Jessica Williams',
    project: 'E-commerce Platform',
    timestamp: '2025-09-30T16:30:00Z',
    urgencyScore: 30,
    summary: 'Quick question about the inventory management feature - when can we expect the demo?',
    fullMessage: 'Hey! Just checking in on the inventory management module. Any ETA on the demo?',
    isReplied: true,
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face'
  },
  {
    id: 'm6',
    clientName: 'David Park',
    project: 'Mobile Banking App',
    timestamp: '2025-09-30T14:00:00Z',
    urgencyScore: 55,
    summary: 'Transaction history API is working great! Ready for the next milestone when you are.',
    fullMessage: 'The transaction API integration is flawless. Documentation is clear. Ready to move forward!',
    isReplied: true,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face'
  }
];

// Create the Context
const MessageContext = createContext(undefined);

// Provider Component
export const MessageProvider = ({ children }) => {
  const { db, userId } = useAuth();
  const { showError } = useToast();

  // Only show mock data for eltrozo@lunara.com
  const userEmail = localStorage.getItem('user_email');
  const shouldShowMockData = userEmail === 'eltrozo@lunara.com';
  const emptyMessages = [];

  const [messages, setMessages] = useState(shouldShowMockData ? initialMessages : emptyMessages);
  const [loading, setLoading] = useState(true);
  const [useFirestore, setUseFirestore] = useState(false);

  // Set up Firestore real-time listener
  useEffect(() => {
    if (!db || !userId) {
      console.log('📭 Firestore not available, using mock data');
      setLoading(false);
      return;
    }

    console.log('🔥 Setting up Firestore listener for messages...');
    const messagesPath = `artifacts/${APP_ID}/public/data/messages`;
    const messagesRef = collection(db, messagesPath);

    const unsubscribe = onSnapshot(
      messagesRef,
      (snapshot) => {
        console.log('📨 Received Firestore update:', snapshot.size, 'messages');

        if (snapshot.empty) {
          console.log('📭 No messages in Firestore');
          // Only use mock data for eltrozo@lunara.com
          if (shouldShowMockData) {
            console.log('📋 Using mock data for eltrozo@lunara.com');
            setMessages(initialMessages);
          } else {
            console.log('📋 No mock data for this user');
            setMessages(emptyMessages);
          }
          setUseFirestore(false);
          setLoading(false);
          return;
        }

        const firestoreMessages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setMessages(firestoreMessages);
        setUseFirestore(true);
        setLoading(false);
        console.log('✅ Messages loaded from Firestore');
      },
      (error) => {
        console.error('❌ Firestore listener error:', error);
        // Only use mock data for eltrozo@lunara.com
        if (shouldShowMockData) {
          showError('Connection Error: Using offline data');
          setMessages(initialMessages);
        } else {
          showError('Connection Error: Could not load messages');
          setMessages(emptyMessages);
        }
        setUseFirestore(false);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log('🔌 Unsubscribing from Firestore listener');
      unsubscribe();
    };
  }, [db, userId, showError]);

  // Derived state using useMemo for performance
  const urgentCount = useMemo(() => {
    return messages.filter(msg => msg.urgencyScore > 70 && !msg.isReplied).length;
  }, [messages]);

  const unreadCount = useMemo(() => {
    return messages.filter(msg => !msg.isReplied).length;
  }, [messages]);

  const urgentMessages = useMemo(() => {
    return messages
      .filter(msg => msg.urgencyScore > 70 && !msg.isReplied)
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
  }, [messages]);

  // Update function to mark message as replied (with Firestore persistence)
  const updateMessageStatus = async (messageId, newStatus) => {
    if (useFirestore && db) {
      try {
        const messagesPath = `artifacts/${APP_ID}/public/data/messages`;
        const messageRef = doc(db, messagesPath, messageId);

        console.log('💾 Updating message in Firestore:', messageId);
        await updateDoc(messageRef, newStatus);
        console.log('✅ Message updated successfully');

        // Optimistic UI update (Firestore listener will sync the actual data)
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === messageId ? { ...msg, ...newStatus } : msg
          )
        );
      } catch (error) {
        console.error('❌ Failed to update message:', error);
        showError('Failed to update message');
        throw error;
      }
    } else {
      // Local-only update (no Firestore)
      console.log('📝 Updating message locally (no Firestore):', messageId);
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === messageId ? { ...msg, ...newStatus } : msg
        )
      );
    }
  };

  const value = {
    messages,
    urgentMessages,
    urgentCount,
    unreadCount,
    updateMessageStatus,
    loading,
    useFirestore,
  };

  return (
    <MessageContext.Provider value={value}>
      {children}
    </MessageContext.Provider>
  );
};

// Custom hook for consuming the context
export const useMessageContext = () => {
  const context = useContext(MessageContext);
  if (context === undefined) {
    throw new Error('useMessageContext must be used within a MessageProvider');
  }
  return context;
};

export default MessageContext;
