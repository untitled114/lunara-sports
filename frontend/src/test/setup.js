import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

/* ---------------- POLYFILLS ---------------- */

// Polyfill WeakMap / WeakSet if missing
if (typeof global.WeakMap === 'undefined') global.WeakMap = Map;
if (typeof global.WeakSet === 'undefined') global.WeakSet = Set;

// Dummy URL polyfill for Node environment
if (typeof global.URL === 'undefined') {
  global.URL = class URL {
    constructor(url) { this.href = url; }
  };
}

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
  unobserve() {}
  takeRecords() { return []; }
};

// Mock localStorage
const storage = {};
global.localStorage = {
  getItem: vi.fn(key => storage[key] ?? null),
  setItem: vi.fn((key, value) => { storage[key] = value; }),
  removeItem: vi.fn(key => { delete storage[key]; }),
  clear: vi.fn(() => { Object.keys(storage).forEach(k => delete storage[k]); }),
};

// Mock fetch
global.fetch = vi.fn();

/* ---------------- MOCK MODULES ---------------- */

// Mock Sentry
vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  browserTracingIntegration: vi.fn(),
  replayIntegration: vi.fn(),
}));

// Mock Firebase
vi.mock('../config/firebase', () => ({
  auth: {},
  db: {},
  APP_ID: 'test-app-id',
  authenticateUser: vi.fn().mockResolvedValue({
    userId: 'test-user-123',
    isAnonymous: false,
  }),
}));

// Mock AuthContext
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

// Mock MessageContext
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

/* ---------------- TEST CLEANUP ---------------- */

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.getItem.mockReset();
  localStorage.setItem.mockReset();
  localStorage.removeItem.mockReset();
  localStorage.clear.mockReset();
  global.fetch.mockReset();
});
