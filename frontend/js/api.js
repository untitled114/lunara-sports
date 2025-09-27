/**
 * api.js - Enhanced API Integration Module for SafeSend
 * Handles all API communication with PostgreSQL-backed Django backend
 * Provides real-time data persistence and seamless frontend-backend integration
 */

class SafeSendAPI {
  constructor() {
    this.baseURL = process.env.NODE_ENV === 'production'
      ? 'https://lunara-app-backend.azurecontainer.io/api'  // Production backend URL
      : '/api';  // Local development
    this.tokens = {
      access: localStorage.getItem('safesend_access_token'),
      refresh: localStorage.getItem('safesend_refresh_token')
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
        localStorage.setItem('safesend_access_token', data.access);
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

    localStorage.setItem('safesend_access_token', data.access);
    localStorage.setItem('safesend_refresh_token', data.refresh);
    localStorage.setItem('safesend_user', JSON.stringify(data.user));
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
    } finally {
      this.clearTokens();
      window.location.href = '/signin.html';
    }
  }

  clearTokens() {
    this.tokens.access = null;
    this.tokens.refresh = null;
    localStorage.removeItem('safesend_access_token');
    localStorage.removeItem('safesend_refresh_token');
    localStorage.removeItem('safesend_user');
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
    const userStr = localStorage.getItem('safesend_user');
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
window.SafeSendAPI = new SafeSendAPI();

// Enhanced authentication check for protected pages
function checkAuthentication() {
  if (!window.SafeSendAPI.isAuthenticated()) {
    window.location.href = '/signin.html';
    return false;
  }
  return true;
}

// Enhanced error handling with user feedback
function handleAPIError(error, context = 'API operation') {
  console.error(`${context} failed:`, error);

  if (error.message.includes('401')) {
    showToast('Session expired. Please login again.', 'error');
    window.SafeSendAPI.logout();
  } else if (error.message.includes('403')) {
    showToast('Access denied. You don\'t have permission for this action.', 'error');
  } else if (error.message.includes('404')) {
    showToast('Resource not found.', 'error');
  } else if (error.message.includes('500')) {
    showToast('Server error. Please try again later.', 'error');
  } else {
    showToast(`${context} failed: ${error.message}`, 'error');
  }
}

// Auto-refresh functionality for real-time updates
class DashboardAutoRefresh {
  constructor(intervalMs = 30000) {
    this.interval = intervalMs;
    this.intervalId = null;
    this.isActive = false;
  }

  start(callback) {
    if (this.isActive) return;

    this.isActive = true;
    this.intervalId = setInterval(async () => {
      try {
        await callback();
      } catch (error) {
        console.error('Auto-refresh error:', error);
      }
    }, this.interval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isActive = false;
    }
  }
}

// Global auto-refresh instance
window.DashboardAutoRefresh = new DashboardAutoRefresh();