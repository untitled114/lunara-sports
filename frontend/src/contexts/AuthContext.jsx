import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, authenticateUser } from '../config/firebase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [userId, setUserId] = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { userId: uid, isAnonymous: anon } = await authenticateUser();
        setUserId(uid);
        setIsAnonymous(anon);
      } catch (err) {
        console.error('Authentication error:', err);
        // Generate fallback mock user ID
        const mockUserId = `mock-user-${Date.now()}`;
        setUserId(mockUserId);
        setIsAnonymous(true);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const value = {
    userId,
    isAnonymous,
    loading,
    auth,
    db,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
