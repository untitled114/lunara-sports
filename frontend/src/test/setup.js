// ==============================
// NOTE: Global shims are now in global-shims.js (loaded first)
// ==============================

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// ==============================
// Mock problematic Node modules (hoisted by Vitest)
// ==============================
vi.mock('webidl-conversions', () => {
  const conversions = {};
  conversions.any = (V) => V;
  conversions.boolean = (V) => !!V;
  conversions.USVString = (V) => String(V);
  conversions.DOMString = (V) => String(V);
  conversions.object = (V) => V;
  return conversions;
});

vi.mock('whatwg-url', () => ({
  URL: class URL {
    constructor(href, base) {
      this.href = href || '';
      this.origin = '';
      this.protocol = 'http:';
      this.host = 'localhost';
      this.hostname = 'localhost';
      this.port = '';
      this.pathname = '/';
      this.search = '';
      this.hash = '';
    }
    toString() { return this.href; }
  },
  URLSearchParams: class URLSearchParams {
    constructor() {
      this._params = new Map();
    }
    get(name) { return this._params.get(name) || null; }
    set(name, value) { this._params.set(name, value); }
    has(name) { return this._params.has(name); }
    delete(name) { this._params.delete(name); }
    toString() {
      const parts = [];
      for (const [key, value] of this._params) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
      return parts.join('&');
    }
  },
}));

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
