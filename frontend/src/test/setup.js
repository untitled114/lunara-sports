import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi, beforeAll } from 'vitest';

// Mock Sentry to prevent errors in tests
vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  browserTracingIntegration: vi.fn(),
  replayIntegration: vi.fn(),
}));

// Mock Firebase config to prevent async auth issues in tests
vi.mock('../config/firebase', () => ({
  auth: {},
  db: {},
  APP_ID: 'test-app-id',
  authenticateUser: vi.fn().mockResolvedValue({
    userId: 'test-user-123',
    isAnonymous: false,
  }),
}));

// Mock AuthContext to avoid async state updates in tests
vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    userId: 'test-user-123',
    isAnonymous: false,
    loading: false,
    auth: {},
    db: {},
  }),
}));

// Mock MessageContext to avoid Firebase collection issues
vi.mock('../contexts/MessageContext', () => ({
  MessageProvider: ({ children }) => children,
  useMessages: () => ({
    messages: [],
    unreadCount: 0,
    loading: false,
    error: null,
    refreshMessages: vi.fn(),
    markAsRead: vi.fn(),
  }),
}));

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// Mock localStorage with actual storage
const storage = {};
const localStorageMock = {
  getItem: vi.fn((key) => storage[key] || null),
  setItem: vi.fn((key, value) => { storage[key] = value; }),
  removeItem: vi.fn((key) => { delete storage[key]; }),
  clear: vi.fn(() => { Object.keys(storage).forEach(key => delete storage[key]); }),
};
global.localStorage = localStorageMock;

// Mock fetch
global.fetch = vi.fn();

// Suppress unhandled rejection warnings for expected API errors in tests
const originalUnhandledRejection = process.listeners('unhandledRejection');
process.removeAllListeners('unhandledRejection');
process.on('unhandledRejection', (error) => {
  // Ignore expected APIError rejections in tests
  if (error?.name === 'APIError' || error?.constructor?.name === 'APIError') {
    return;
  }
  // Re-throw other unhandled rejections
  originalUnhandledRejection.forEach(listener => listener(error));
});

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.getItem.mockReset();
  localStorageMock.setItem.mockReset();
  localStorageMock.removeItem.mockReset();
  localStorageMock.clear.mockReset();
  global.fetch.mockReset();
});
