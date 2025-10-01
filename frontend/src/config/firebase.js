import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || window.__firebase_api_key,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || window.__firebase_auth_domain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || window.__firebase_project_id,
};

// App ID for Firestore paths
export const APP_ID = import.meta.env.VITE_APP_ID || window.__app_id || 'lunara-default';

// Initialize Firebase
let app = null;
let auth = null;
let db = null;
let isFirebaseAvailable = false;

// Only initialize if we have valid Firebase credentials
if (firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseAvailable = true;
    console.log('✅ Firebase initialized successfully');
  } catch (error) {
    console.warn('⚠️ Firebase initialization failed:', error.message);
    console.log('📭 App will run in offline mode with mock data');
  }
} else {
  console.log('📭 No Firebase credentials found - running in offline mode');
  console.log('💡 To enable Firebase, set VITE_FIREBASE_* environment variables');
}

/**
 * Authenticate user with __initial_auth_token or fall back to anonymous sign-in
 * @returns {Promise<{userId: string, isAnonymous: boolean}>}
 */
export async function authenticateUser() {
  // If Firebase is not available, generate a mock user ID
  if (!isFirebaseAvailable || !auth) {
    console.log('📭 Firebase not available - using mock user ID');
    const mockUserId = `mock-user-${Date.now()}`;
    return { userId: mockUserId, isAnonymous: true };
  }

  const initialToken = window.__initial_auth_token;

  try {
    if (initialToken) {
      // Authenticate with custom token
      console.log('🔐 Authenticating with __initial_auth_token...');
      const userCredential = await signInWithCustomToken(auth, initialToken);
      const userId = userCredential.user.uid;
      console.log('✅ Authenticated as:', userId);
      return { userId, isAnonymous: false };
    } else {
      // Fall back to anonymous sign-in
      console.log('🔐 No __initial_auth_token found, signing in anonymously...');
      const userCredential = await signInAnonymously(auth);
      const userId = userCredential.user.uid;
      console.log('✅ Signed in anonymously as:', userId);
      return { userId, isAnonymous: true };
    }
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    // Generate mock user ID as fallback
    const mockUserId = `mock-user-${Date.now()}`;
    console.log('📭 Using mock user ID:', mockUserId);
    return { userId: mockUserId, isAnonymous: true };
  }
}

export { app, auth, db, isFirebaseAvailable };
