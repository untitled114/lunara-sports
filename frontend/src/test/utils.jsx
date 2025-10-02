import React from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import { MessageProvider } from '../contexts/MessageContext';

/**
 * Custom render function that wraps components with necessary providers
 * @param {React.ReactElement} ui - Component to render
 * @param {Object} options - Additional render options
 * @returns {Object} - RTL render result
 */
export function renderWithProviders(ui, options = {}) {
  const { route = '/', ...renderOptions } = options;

  // Set the initial route
  window.history.pushState({}, 'Test page', route);

  function Wrapper({ children }) {
    return (
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <MessageProvider>
              {children}
            </MessageProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Mock successful API response
 * @param {*} data - Data to return
 * @returns {Promise} - Mock fetch promise
 */
export function mockApiSuccess(data) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data }),
    headers: new Headers(),
  });
}

/**
 * Mock API error response
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @returns {Promise} - Mock fetch promise
 */
export function mockApiError(status, message = 'Error') {
  return Promise.resolve({
    ok: false,
    status,
    json: async () => ({ success: false, error: message }),
    headers: new Headers(),
  });
}

/**
 * Mock network error (no connection)
 * @returns {Promise} - Rejected promise
 */
export function mockNetworkError() {
  return Promise.reject(new Error('Network error'));
}

/**
 * Wait for async operations to complete
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise}
 */
export function wait(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create mock project data
 * @param {Object} overrides - Properties to override
 * @returns {Object} - Mock project object
 */
export function createMockProject(overrides = {}) {
  return {
    id: 1,
    title: 'Test Project',
    client: 'Test Client',
    description: 'Test description',
    value: 1000,
    deadline: '2025-12-31',
    priority: 'medium',
    status: 'active',
    progress: 50,
    ...overrides,
  };
}

/**
 * Create mock message data
 * @param {Object} overrides - Properties to override
 * @returns {Object} - Mock message object
 */
export function createMockMessage(overrides = {}) {
  return {
    id: 1,
    sender: 'Test Sender',
    preview: 'Test message',
    time: '2 hours ago',
    unread: false,
    ...overrides,
  };
}

/**
 * Setup authenticated user mock
 */
export function mockAuthenticatedUser() {
  localStorage.setItem('auth_token', 'mock-token-123');
  return {
    uid: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
  };
}

/**
 * Clear authentication mock
 */
export function mockUnauthenticatedUser() {
  localStorage.removeItem('auth_token');
}

// Re-export everything from RTL
export * from '@testing-library/react';
