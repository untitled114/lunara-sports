/**
 * api.js - Enhanced API Integration Module for Lunara
 * Handles all API communication with PostgreSQL-backed Django backend
 * Provides real-time data persistence and seamless frontend-backend integration
 * Updated: Fixed process.env browser compatibility issue + logout flow
 */

class LunaraAPI {
  constructor() {
    // Detect environment based on hostname
    const isProduction = window.location.hostname !== 'localhost' &&
                        window.location.hostname !== '127.0.0.1' &&
                        !window.location.hostname.includes('192.168');

    this.baseURL = isProduction
      ? 'https://lunara-api.thankfulhill-c6015f7f.eastus.azurecontainerapps.io/api'  // NEW Production HTTPS backend URL
      : 'http://127.0.0.1:8000/api';  // Local development - Django backend
    this.tokens = {
      access: localStorage.getItem('lunara_access_token'),
      refresh: localStorage.getItem('lunara_refresh_token')
    };
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  // Enhanced authentication headers with error handling
  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (this.tokens.access) {
      headers['Authorization'] = `Bearer ${this.tokens.access}`;
    }

    return headers;
  }

  // Enhanced token refresh with retry logic
  async refreshToken() {
    if (!this.tokens.refresh) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh: this.tokens.refresh
        })
      });

      if (response.ok) {
        const data = await response.json();
        this.tokens.access = data.access;
        localStorage.setItem('lunara_access_token', data.access);
        return data.access;
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      this.logout();
      throw error;
    }
  }

  // Enhanced API request with retry logic and better error handling
  async apiRequest(endpoint, options = {}) {
    let lastError;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        let response = await fetch(`${this.baseURL}${endpoint}`, {
          ...options,
          headers: {
            ...this.getAuthHeaders(),
            ...options.headers
          }
        });

        // Handle token refresh for 401 responses
        if (response.status === 401 && this.tokens.refresh && attempt === 0) {
          try {
            await this.refreshToken();
            response = await fetch(`${this.baseURL}${endpoint}`, {
              ...options,
              headers: {
                ...this.getAuthHeaders(),
                ...options.headers
              }
            });
          } catch (refreshError) {
            this.logout();
            throw refreshError;
          }
        }

        if (response.ok) {
          return response;
        } else if (response.status >= 500 && attempt < this.retryAttempts - 1) {
          // Retry on server errors
          await this.delay(this.retryDelay * Math.pow(2, attempt));
          continue;
        } else {
          // Client errors or final attempt
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}`);
        }
      } catch (error) {
        lastError = error;
        if (attempt < this.retryAttempts - 1 && !error.message.includes('fetch')) {
          await this.delay(this.retryDelay * Math.pow(2, attempt));
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  // Utility delay function
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== AUTHENTICATION METHODS =====

  async login(email, password) {
    const response = await fetch(`${this.baseURL}/auth/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    if (response.ok) {
      const data = await response.json();
      this.setTokens(data);
      return data;
    } else {
      const error = await response.json();
      throw new Error(error.detail || error.error || 'Login failed');
    }
  }

  async register(userData) {
    const response = await fetch(`${this.baseURL}/auth/register/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData)
    });

    if (response.ok) {
      const data = await response.json();
      this.setTokens(data);
      return data;
    } else {
      const error = await response.json();
      throw new Error(error.detail || error.error || 'Registration failed');
    }
  }

  setTokens(data) {
    this.tokens.access = data.access;
    this.tokens.refresh = data.refresh;

    localStorage.setItem('lunara_access_token', data.access);
    localStorage.setItem('lunara_refresh_token', data.refresh);
    localStorage.setItem('lunara_user', JSON.stringify(data.user));
  }

  async logout() {
    try {
      if (this.tokens.refresh) {
        await this.apiRequest('/auth/logout/', {
          method: 'POST',
          body: JSON.stringify({
            refresh: this.tokens.refresh
          })
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with logout even if API call fails
    } finally {
      this.clearTokens();
      // Use Firefox-compatible navigation
      if (window.LunaraNavigate) {
        window.LunaraNavigate('index.html');
      } else {
        window.location.href = 'index.html';
      }
    }
  }

  clearTokens() {
    this.tokens.access = null;
    this.tokens.refresh = null;
    localStorage.removeItem('lunara_access_token');
    localStorage.removeItem('lunara_refresh_token');
    localStorage.removeItem('lunara_user');
  }

  // ===== USER PROFILE METHODS =====

  async getProfile() {
    const response = await this.apiRequest('/auth/profile/');
    return response.json();
  }

  async updateProfile(profileData) {
    const response = await this.apiRequest('/auth/profile/update/', {
      method: 'PATCH',
      body: JSON.stringify(profileData)
    });
    return response.json();
  }

  // ===== DASHBOARD METHODS =====

  async getDashboardStats() {
    const response = await this.apiRequest('/auth/dashboard/stats/');
    return response.json();
  }

  // ===== PROJECT METHODS =====

  async getProjects(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await this.apiRequest(`/projects/?${params}`);
    return response.json();
  }

  async getMyProjects(status = null) {
    const params = status ? `?status=${status}` : '';
    const response = await this.apiRequest(`/projects/my_projects/${params}`);
    return response.json();
  }

  async createProject(projectData) {
    const response = await this.apiRequest('/projects/', {
      method: 'POST',
      body: JSON.stringify(projectData)
    });
    return response.json();
  }

  async getProject(projectId) {
    const response = await this.apiRequest(`/projects/${projectId}/`);
    return response.json();
  }

  async updateProject(projectId, projectData) {
    const response = await this.apiRequest(`/projects/${projectId}/`, {
      method: 'PATCH',
      body: JSON.stringify(projectData)
    });
    return response.json();
  }

  async deleteProject(projectId) {
    const response = await this.apiRequest(`/projects/${projectId}/`, {
      method: 'DELETE'
    });
    return response.ok;
  }

  async assignFreelancer(projectId, freelancerId) {
    const response = await this.apiRequest(`/projects/${projectId}/assign_freelancer/`, {
      method: 'POST',
      body: JSON.stringify({ freelancer_id: freelancerId })
    });
    return response.json();
  }

  async completeProject(projectId) {
    const response = await this.apiRequest(`/projects/${projectId}/complete_project/`, {
      method: 'POST'
    });
    return response.json();
  }

  // ===== MILESTONE METHODS =====

  async getMilestones(projectId) {
    const response = await this.apiRequest(`/projects/${projectId}/milestones/`);
    return response.json();
  }

  async createMilestone(projectId, milestoneData) {
    const response = await this.apiRequest(`/projects/${projectId}/milestones/`, {
      method: 'POST',
      body: JSON.stringify(milestoneData)
    });
    return response.json();
  }

  async updateMilestone(projectId, milestoneId, milestoneData) {
    const response = await this.apiRequest(`/projects/${projectId}/milestones/${milestoneId}/`, {
      method: 'PATCH',
      body: JSON.stringify(milestoneData)
    });
    return response.json();
  }

  async submitMilestone(projectId, milestoneId, deliverables, notes) {
    const response = await this.apiRequest(`/projects/${projectId}/milestones/${milestoneId}/submit/`, {
      method: 'POST',
      body: JSON.stringify({
        deliverables,
        submission_notes: notes
      })
    });
    return response.json();
  }

  async reviewMilestone(projectId, milestoneId, approved, reviewNotes) {
    const response = await this.apiRequest(`/projects/${projectId}/milestones/${milestoneId}/review/`, {
      method: 'POST',
      body: JSON.stringify({
        approved,
        review_notes: reviewNotes
      })
    });
    return response.json();
  }

  async startMilestone(projectId, milestoneId) {
    const response = await this.apiRequest(`/projects/${projectId}/milestones/${milestoneId}/start/`, {
      method: 'POST'
    });
    return response.json();
  }

  // ===== PROJECT INVITATION METHODS =====

  async getInvitations() {
    const response = await this.apiRequest('/projects/invitations/');
    return response.json();
  }

  async acceptInvitation(invitationId) {
    const response = await this.apiRequest(`/projects/invitations/${invitationId}/accept/`, {
      method: 'POST'
    });
    return response.json();
  }

  async declineInvitation(invitationId) {
    const response = await this.apiRequest(`/projects/invitations/${invitationId}/decline/`, {
      method: 'POST'
    });
    return response.json();
  }

  // ===== UTILITY METHODS =====

  isAuthenticated() {
    return !!this.tokens.access;
  }

  getCurrentUser() {
    const userStr = localStorage.getItem('lunara_user');
    return userStr ? JSON.parse(userStr) : null;
  }

  async checkEmailAvailability(email) {
    try {
      const response = await fetch(`${this.baseURL}/auth/check-email/?email=${encodeURIComponent(email)}`);
      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.error('Email check error:', error);
    }
    return { available: false };
  }

  async checkUsernameAvailability(username) {
    try {
      const response = await fetch(`${this.baseURL}/auth/check-username/?username=${encodeURIComponent(username)}`);
      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.error('Username check error:', error);
    }
    return { available: false };
  }

  // Real-time update methods for dashboard
  async refreshDashboardData() {
    try {
      const [stats, projects] = await Promise.all([
        this.getDashboardStats(),
        this.getMyProjects()
      ]);

      return { stats, projects };
    } catch (error) {
      console.error('Dashboard refresh error:', error);
      throw error;
    }
  }

  // Batch operations for better performance
  async batchApiRequest(requests) {
    try {
      const promises = requests.map(({ endpoint, options }) =>
        this.apiRequest(endpoint, options)
      );

      const responses = await Promise.all(promises);
      return await Promise.all(responses.map(response => response.json()));
    } catch (error) {
      console.error('Batch request error:', error);
      throw error;
    }
  }

  // ===== PAYMENT METHODS =====

  async getEscrowAccounts() {
    const response = await this.apiRequest('/payments/escrow/');
    return response.json();
  }

  async getTransactions() {
    const response = await this.apiRequest('/payments/transactions/');
    return response.json();
  }

  async createTransaction(transactionData) {
    const response = await this.apiRequest('/payments/transactions/', {
      method: 'POST',
      body: JSON.stringify(transactionData)
    });
    return response.json();
  }

  async getPaymentMethods() {
    const response = await this.apiRequest('/payments/payment-methods/');
    return response.json();
  }

  async addPaymentMethod(paymentMethodData) {
    const response = await this.apiRequest('/payments/payment-methods/', {
      method: 'POST',
      body: JSON.stringify(paymentMethodData)
    });
    return response.json();
  }

  async removePaymentMethod(paymentMethodId) {
    const response = await this.apiRequest(`/payments/payment-methods/${paymentMethodId}/`, {
      method: 'DELETE'
    });
    return response.ok;
  }

  async depositFunds(projectId, amount, paymentMethodId) {
    const response = await this.apiRequest(`/payments/projects/${projectId}/deposit/`, {
      method: 'POST',
      body: JSON.stringify({
        amount: amount,
        payment_method_id: paymentMethodId
      })
    });
    return response.json();
  }

  async releaseMilestonePayment(projectId, milestoneId) {
    const response = await this.apiRequest(`/payments/projects/${projectId}/milestones/${milestoneId}/release/`, {
      method: 'POST'
    });
    return response.json();
  }

  async getPaymentDashboard() {
    const response = await this.apiRequest('/payments/dashboard/');
    return response.json();
  }

  async getDisputes() {
    const response = await this.apiRequest('/payments/disputes/');
    return response.json();
  }

  async createDispute(disputeData) {
    const response = await this.apiRequest('/payments/disputes/', {
      method: 'POST',
      body: JSON.stringify(disputeData)
    });
    return response.json();
  }

  // ===== FILE UPLOAD METHODS =====

  async uploadProjectFile(projectId, file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.apiRequest(`/projects/${projectId}/files/upload/`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${this.tokens.access}`
        // Don't set Content-Type - let browser set it with boundary for FormData
      }
    });
    return response.json();
  }

  async getProjectFiles(projectId) {
    const response = await this.apiRequest(`/projects/${projectId}/files/`);
    return response.json();
  }

  async deleteProjectFile(projectId, fileIndex) {
    const response = await this.apiRequest(`/projects/${projectId}/files/${fileIndex}/delete/`, {
      method: 'DELETE'
    });
    return response.json();
  }
}

// Create global API instance with enhanced functionality
window.LunaraAPI = new LunaraAPI();

// Enhanced authentication check for protected pages
function checkAuthentication() {
  if (!window.LunaraAPI.isAuthenticated()) {
    // Use Firefox-compatible navigation
    if (window.LunaraNavigate) {
      window.LunaraNavigate('signin.html');
    } else {
      window.location.href = '/signin.html';
    }
    return false;
  }
  return true;
}

// Enhanced error handling with user feedback
function handleAPIError(error, context = 'API operation') {
  console.error(`${context} failed:`, error);

  if (error.message.includes('401')) {
    showNotification('Session expired. Please login again.', 'error');
    window.LunaraAPI.logout();
  } else if (error.message.includes('403')) {
    showNotification('Access denied. You don\'t have permission for this action.', 'error');
  } else if (error.message.includes('404')) {
    showNotification('Resource not found.', 'error');
  } else if (error.message.includes('500')) {
    showNotification('Server error. Please try again later.', 'error');
  } else if (error.message.includes('Network')) {
    showNotification('Network error. Please check your connection.', 'error');
  } else {
    showNotification(`${context} failed: ${error.message}`, 'error');
  }
}

// Enhanced notification system
function showNotification(message, type = 'info', duration = 5000) {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notification => notification.remove());

  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-message">${message}</span>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;

  // Add styles if not already present
  if (!document.getElementById('notification-styles')) {
    const styles = document.createElement('style');
    styles.id = 'notification-styles';
    styles.innerHTML = `
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        min-width: 300px;
        max-width: 500px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideInRight 0.3s ease-out;
      }
      .notification-success { background-color: #10b981; }
      .notification-error { background-color: #ef4444; }
      .notification-warning { background-color: #f59e0b; }
      .notification-info { background-color: #3b82f6; }
      .notification-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        margin-left: 10px;
      }
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(styles);
  }

  // Add to page
  document.body.appendChild(notification);

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }
}

// Backward compatibility
function showToast(message, type, duration) {
  showNotification(message, type, duration);
}

// Enhanced real-time update system
class RealTimeUpdates {
  constructor(intervalMs = 30000) {
    this.interval = intervalMs;
    this.intervalId = null;
    this.isActive = false;
    this.callbacks = new Map();
    this.lastUpdateTimes = new Map();
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  // Register a callback for specific data updates
  subscribe(key, callback, options = {}) {
    this.callbacks.set(key, {
      callback,
      interval: options.interval || this.interval,
      lastRun: 0,
      errorCount: 0
    });
  }

  // Unregister a callback
  unsubscribe(key) {
    this.callbacks.delete(key);
  }

  // Start real-time updates
  start() {
    if (this.isActive) return;

    this.isActive = true;
    this.intervalId = setInterval(async () => {
      await this.executeCallbacks();
    }, 5000); // Check every 5 seconds, but respect individual intervals

    // Initial execution
    this.executeCallbacks();
  }

  // Stop real-time updates
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isActive = false;
    }
  }

  // Execute all registered callbacks based on their intervals
  async executeCallbacks() {
    const now = Date.now();

    for (const [key, config] of this.callbacks.entries()) {
      const timeSinceLastRun = now - config.lastRun;

      if (timeSinceLastRun >= config.interval) {
        try {
          await config.callback();
          config.lastRun = now;
          config.errorCount = 0;
          this.retryCount = 0;
        } catch (error) {
          config.errorCount++;
          console.error(`Real-time update error for ${key}:`, error);

          // Stop retrying if too many errors
          if (config.errorCount >= this.maxRetries) {
            console.warn(`Stopping real-time updates for ${key} due to repeated errors`);
            this.unsubscribe(key);
          }
        }
      }
    }
  }

  // Trigger immediate update for specific key
  async triggerUpdate(key) {
    const config = this.callbacks.get(key);
    if (config) {
      try {
        await config.callback();
        config.lastRun = Date.now();
        config.errorCount = 0;
      } catch (error) {
        console.error(`Manual update error for ${key}:`, error);
        throw error;
      }
    }
  }

  // Check if updates are active
  isRunning() {
    return this.isActive;
  }

  // Get status of all subscriptions
  getStatus() {
    const status = {};
    for (const [key, config] of this.callbacks.entries()) {
      status[key] = {
        lastRun: config.lastRun,
        errorCount: config.errorCount,
        interval: config.interval
      };
    }
    return status;
  }
}

// Global real-time updates instance
window.RealTimeUpdates = new RealTimeUpdates();

// Backward compatibility
class DashboardAutoRefresh {
  constructor(intervalMs = 30000) {
    this.interval = intervalMs;
  }

  start(callback) {
    window.RealTimeUpdates.subscribe('dashboard', callback, { interval: this.interval });
    window.RealTimeUpdates.start();
  }

  stop() {
    window.RealTimeUpdates.unsubscribe('dashboard');
  }
}

// Global auto-refresh instance for backward compatibility
window.DashboardAutoRefresh = new DashboardAutoRefresh();

// Enhanced data synchronization utilities
class DataSync {
  constructor() {
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.cacheTTL = 60000; // 1 minute cache TTL
  }

  // Get data with caching
  async getData(key, fetchFunction, forceRefresh = false) {
    const now = Date.now();
    const cached = this.cache.get(key);
    const timestamp = this.cacheTimestamps.get(key);

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && cached && timestamp && (now - timestamp) < this.cacheTTL) {
      return cached;
    }

    try {
      const data = await fetchFunction();
      this.cache.set(key, data);
      this.cacheTimestamps.set(key, now);
      return data;
    } catch (error) {
      // Return stale data if available
      if (cached) {
        console.warn(`Using stale data for ${key} due to fetch error:`, error);
        return cached;
      }
      throw error;
    }
  }

  // Clear cache for specific key or all
  clearCache(key = null) {
    if (key) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    } else {
      this.cache.clear();
      this.cacheTimestamps.clear();
    }
  }

  // Set cache TTL
  setCacheTTL(ttl) {
    this.cacheTTL = ttl;
  }
}

// Global data sync instance
window.DataSync = new DataSync();