import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// ==============================
// Fix for webidl-conversions errors
// ==============================
if (typeof globalThis.WeakMap === 'undefined') globalThis.WeakMap = Map;
if (typeof globalThis.WeakSet === 'undefined') globalThis.WeakSet = Set;
if (typeof globalThis.ArrayBuffer === 'undefined') globalThis.ArrayBuffer = class {};
if (typeof globalThis.DataView === 'undefined') globalThis.DataView = class {};

// Optional: mock URL class to prevent whatwg-url from crashing
if (typeof globalThis.URL === 'undefined') {
  globalThis.URL = class {
    constructor(href) { this.href = href; }
  };
}
// ==============================
// Mock Sentry
// ==============================
vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  browserTracingIntegration: vi.fn(),
  replayIntegration: vi.fn(),
}));

// ==============================
// Mock Firebase
// ==============================
vi.mock('../config/firebase', () => ({
  auth: {},
  db: {},
  APP_ID: 'test-app-id',
  authenticateUser: vi.fn().mockResolvedValue({
    userId: 'test-user-123',
    isAnonymous: false,
  }),
}));

// ==============================
// Mock AuthContext
// ==============================
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

// ==============================
// Mock MessageContext
// ==============================
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

// ==============================
// Cleanup
// ==============================
afterEach(() => {
  cleanup();
});

// ==============================
// Mock window APIs
// ==============================
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

global.IntersectionObserver = class {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() { return []; }
  unobserve() {}
};

const storage = {};
global.localStorage = {
  getItem: vi.fn(key => storage[key] || null),
  setItem: vi.fn((key, value) => { storage[key] = value; }),
  removeItem: vi.fn(key => { delete storage[key]; }),
  clear: vi.fn(() => { Object.keys(storage).forEach(key => delete storage[key]); }),
};

global.fetch = vi.fn();

// Suppress unhandled rejections
const originalUnhandled = process.listeners('unhandledRejection');
process.removeAllListeners('unhandledRejection');
process.on('unhandledRejection', error => {
  if (error?.name === 'APIError' || error?.constructor?.name === 'APIError') return;
  originalUnhandled.forEach(listener => listener(error));
});

// Reset mocks
beforeEach(() => {
  vi.clearAllMocks();
  global.fetch.mockReset();
  Object.values(global.localStorage).forEach(fn => fn.mockReset?.());
});
