/**
 * API Service Layer
 * Centralized API client with authentication, retry logic, and error handling
 */

import * as Sentry from '@sentry/react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Start with 1 second

/**
 * Log API errors to console and Sentry
 */
const logAPIError = (error, context = {}) => {
  const errorData = {
    message: error.message,
    status: error.status,
    url: context.url,
    method: context.method,
    isNetworkError: error.isNetworkError,
    isClientError: error.isClientError,
    isServerError: error.isServerError,
    data: error.data,
  };

  // Log to console
  console.error('🚨 API Error:', errorData);

  // Log to Sentry if enabled
  if (import.meta.env.VITE_ENABLE_SENTRY === 'true') {
    Sentry.captureException(error, {
      tags: {
        api_call: true,
        status: error.status,
        error_type: error.isNetworkError ? 'network' : error.isClientError ? 'client' : 'server',
      },
      extra: errorData,
    });
  }
};

/**
 * Custom API Error class for better error handling
 */
export class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
    this.isClientError = status >= 400 && status < 500;
    this.isServerError = status >= 500;
    this.isNetworkError = !status;
  }
}

/**
 * Sleep utility for retry delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Exponential backoff calculation
 */
const getRetryDelay = (attempt) => RETRY_DELAY * Math.pow(2, attempt);

/**
 * Check if error is retryable
 */
const isRetryableError = (error) => {
  // Retry on network errors or 5xx server errors
  return error.isNetworkError || error.isServerError || error.status === 429;
};

/**
 * Get auth token from localStorage
 */
const getAuthToken = () => {
  return localStorage.getItem('auth_token');
};

/**
 * Get refresh token from localStorage
 */
const getRefreshToken = () => {
  return localStorage.getItem('refresh_token');
};

/**
 * Decode JWT token to get expiration time
 */
const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
};

/**
 * Check if token is expired or will expire soon (within 5 minutes)
 */
const isTokenExpiringSoon = (token) => {
  if (!token) return true;

  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;

  const currentTime = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = decoded.exp - currentTime;

  // Refresh if token expires in less than 5 minutes (300 seconds)
  return timeUntilExpiry < 300;
};

/**
 * Refresh the access token using refresh token
 */
let isRefreshing = false;
let refreshPromise = null;

const refreshAccessToken = async () => {
  // If already refreshing, return the existing promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;

  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      console.log('🔄 Refreshing access token...');

      const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();

      // Update access token
      if (data.access) {
        localStorage.setItem('auth_token', data.access);
        console.log('✅ Access token refreshed successfully');
        return data.access;
      }

      throw new Error('No access token in refresh response');
    } catch (error) {
      console.error('❌ Token refresh failed:', error);

      // Clear tokens and redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_email');
      localStorage.removeItem('user_name');
      localStorage.removeItem('user_id');

      // Store redirect path
      const currentPath = window.location.pathname;
      if (currentPath !== '/signin' && currentPath !== '/signup') {
        localStorage.setItem('redirect_after_login', currentPath);
      }

      window.location.href = '/signin';
      throw error;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Base fetch wrapper with auth and error handling
 */
const baseFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  let token = getAuthToken();

  // Check if token needs refresh (skip for auth endpoints)
  const isAuthEndpoint = endpoint.includes('/auth/login') ||
                         endpoint.includes('/auth/signup') ||
                         endpoint.includes('/auth/refresh');

  if (token && !isAuthEndpoint && isTokenExpiringSoon(token)) {
    try {
      token = await refreshAccessToken();
    } catch (error) {
      // Refresh failed, will be handled below or user redirected
      console.warn('Token refresh failed in baseFetch:', error);
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add auth token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Parse response
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Handle 401 Unauthorized - redirect to signin (but not for login/signup endpoints)
    if (response.status === 401) {
      // Don't redirect if this is a login or signup request (those are expected to return 401 for bad credentials)
      const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/signup');

      if (!isAuthEndpoint) {
        // Clear auth tokens
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_id');

        // Store current path for redirect after login
        const currentPath = window.location.pathname;
        if (currentPath !== '/signin' && currentPath !== '/signup') {
          localStorage.setItem('redirect_after_login', currentPath);
        }

        // Redirect to signin
        window.location.href = '/signin';
      }

      throw new APIError(
        data.message || data.error || 'Unauthorized',
        401,
        data
      );
    }

    // Handle non-2xx responses
    if (!response.ok) {
      throw new APIError(
        data.message || data.error || `Request failed with status ${response.status}`,
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    // Network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new APIError('Network error - please check your connection', null, null);
    }

    // Re-throw API errors
    if (error instanceof APIError) {
      throw error;
    }

    // Unknown errors
    throw new APIError(error.message || 'Unknown error occurred', null, null);
  }
};

/**
 * Fetch with retry logic
 */
const fetchWithRetry = async (endpoint, options = {}, retryCount = 0) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = options.method || 'GET';

  try {
    return await baseFetch(endpoint, options);
  } catch (error) {
    // Log error on first failure
    if (retryCount === 0) {
      logAPIError(error, { url, method, endpoint });
    }

    // Don't retry client errors (4xx) EXCEPT 429 (rate limit - should retry)
    if (error.isClientError && error.status !== 429) {
      throw error;
    }

    // Retry if possible
    if (retryCount < MAX_RETRIES && isRetryableError(error)) {
      const delay = getRetryDelay(retryCount);
      console.warn(`⚠️  Request failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await sleep(delay);
      return fetchWithRetry(endpoint, options, retryCount + 1);
    }

    // Max retries reached or non-retryable error
    // Log to Sentry if we've exhausted retries
    if (retryCount >= MAX_RETRIES && import.meta.env.VITE_ENABLE_SENTRY === 'true') {
      Sentry.captureException(error, {
        tags: {
          api_call: true,
          max_retries_reached: true,
          status: error.status,
        },
        extra: {
          url,
          method,
          endpoint,
          retryCount,
        },
      });
    }

    throw error;
  }
};

/**
 * API client methods
 */
export const api = {
  // GET request
  get: (endpoint, options = {}) => {
    return fetchWithRetry(endpoint, {
      method: 'GET',
      ...options,
    });
  },

  // POST request
  post: (endpoint, data, options = {}) => {
    return fetchWithRetry(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options,
    });
  },

  // PUT request
  put: (endpoint, data, options = {}) => {
    return fetchWithRetry(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options,
    });
  },

  // PATCH request
  patch: (endpoint, data, options = {}) => {
    return fetchWithRetry(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
      ...options,
    });
  },

  // DELETE request
  delete: (endpoint, options = {}) => {
    return fetchWithRetry(endpoint, {
      method: 'DELETE',
      ...options,
    });
  },

  // Upload file (multipart/form-data)
  upload: (endpoint, formData, options = {}) => {
    const token = getAuthToken();
    const headers = {
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't set Content-Type for FormData, browser will set it with boundary
    return fetchWithRetry(endpoint, {
      method: 'POST',
      body: formData,
      headers,
      ...options,
    });
  },
};

/**
 * Specific API endpoint wrappers
 */

// Projects API
export const projectsAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/projects/${query ? `?${query}` : ''}`);
  },

  getById: (id) => api.get(`/projects/${id}/`),

  create: (data) => api.post('/projects/', data),

  update: (id, data) => api.patch(`/projects/${id}/`, data),

  delete: (id) => api.delete(`/projects/${id}/`),

  updateStatus: (id, status) => api.patch(`/projects/${id}/status/`, { status }),
};

// Messages API
export const messagesAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/messages/${query ? `?${query}` : ''}`);
  },

  getById: (id) => api.get(`/messages/${id}/`),

  send: (data) => api.post('/messages/', data),

  markAsRead: (id) => api.patch(`/messages/${id}/read/`, {}),

  batchReply: (data) => api.post('/messages/batch-reply/', data),

  broadcast: (data) => api.post('/messages/broadcast/', data),
};

// Payments API
export const paymentsAPI = {
  // Use transactions endpoint which exists in backend
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/payments/transactions/${query ? `?${query}` : ''}`);
  },

  getById: (id) => api.get(`/payments/transactions/${id}/`),

  sendReminder: (id) => api.post(`/payments/${id}/remind/`, {}),

  downloadReceipt: (id) => api.get(`/payments/${id}/receipt/`),

  // Payment methods (backend has this)
  getPaymentMethods: () => api.get('/payments/payment-methods/'),

  addPaymentMethod: (data) => api.post('/payments/payment-methods/', data),

  removePaymentMethod: (id) => api.delete(`/payments/payment-methods/${id}/`),
};

// Invoices API
export const invoicesAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/invoices/${query ? `?${query}` : ''}`);
  },

  getById: (id) => api.get(`/invoices/${id}/`),

  create: (data) => api.post('/invoices/', data),

  download: (id) => api.get(`/invoices/${id}/download/`),
};

// Profile API
export const profileAPI = {
  // Use backend /auth/profile/ endpoint
  get: () => api.get('/auth/profile/'),

  update: (data) => api.patch('/auth/profile/update/', data),

  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.upload('/auth/profile/avatar/', formData);
  },
};

// Payouts API
export const payoutsAPI = {
  request: (data) => api.post('/payouts/request/', data),

  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/payouts/${query ? `?${query}` : ''}`);
  },
};

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login/', { email, password }),

  signup: (data) => api.post('/auth/register/', data),

  logout: () => api.post('/auth/logout/', {}),

  refreshToken: () => api.post('/auth/refresh/', {}),

  forgotPassword: (email) => api.post('/auth/forgot-password/', { email }),

  resetPassword: (token, password) => api.post('/auth/reset-password/', { token, password }),
};

export default api;
