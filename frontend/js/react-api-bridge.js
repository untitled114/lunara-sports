/**
 * react-api-bridge.js - React API Bridge
 *
 * Provides React-friendly hooks and utilities for communicating with Django backend
 * Wraps the existing LunaraAPI class with React-specific patterns
 */

(function() {
  'use strict';

  /**
   * React API Bridge - Makes LunaraAPI easier to use in React components
   */
  class ReactAPIBridge {
    constructor() {
      // Wait for LunaraAPI to be available
      this.api = null;
      this.initPromise = this.waitForAPI();
    }

    /**
     * Wait for LunaraAPI to be loaded
     */
    async waitForAPI() {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50;

        const checkInterval = setInterval(() => {
          attempts++;

          if (window.LunaraAPI) {
            this.api = window.LunaraAPI;
            clearInterval(checkInterval);
            console.log('✅ React API Bridge connected to LunaraAPI');
            resolve(this.api);
          }

          if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            reject(new Error('LunaraAPI not available'));
          }
        }, 100);
      });
    }

    /**
     * Ensure API is initialized before making calls
     */
    async ensureInitialized() {
      if (!this.api) {
        await this.initPromise;
      }
      return this.api;
    }

    // ===== AUTHENTICATION METHODS =====

    /**
     * Check if user is authenticated
     */
    async isAuthenticated() {
      const api = await this.ensureInitialized();
      return api.isAuthenticated();
    }

    /**
     * Get current user
     */
    async getCurrentUser() {
      const api = await this.ensureInitialized();
      return api.getCurrentUser();
    }

    /**
     * Login
     */
    async login(email, password) {
      const api = await this.ensureInitialized();
      return api.login(email, password);
    }

    /**
     * Register new user
     */
    async register(userData) {
      const api = await this.ensureInitialized();
      return api.register(userData);
    }

    /**
     * Logout
     */
    async logout() {
      const api = await this.ensureInitialized();
      return api.logout();
    }

    // ===== PROJECT METHODS =====

    /**
     * Get all projects
     */
    async getProjects() {
      const api = await this.ensureInitialized();
      return api.getProjects();
    }

    /**
     * Get single project by ID
     */
    async getProject(projectId) {
      const api = await this.ensureInitialized();
      return api.getProject(projectId);
    }

    /**
     * Create new project
     */
    async createProject(projectData) {
      const api = await this.ensureInitialized();
      return api.createProject(projectData);
    }

    /**
     * Update project
     */
    async updateProject(projectId, projectData) {
      const api = await this.ensureInitialized();
      return api.updateProject(projectId, projectData);
    }

    /**
     * Delete project
     */
    async deleteProject(projectId) {
      const api = await this.ensureInitialized();
      return api.deleteProject(projectId);
    }

    // ===== DASHBOARD METHODS =====

    /**
     * Get dashboard data (stats + projects)
     */
    async getDashboardData() {
      const api = await this.ensureInitialized();
      return api.refreshDashboardData();
    }

    // ===== UTILITY METHODS =====

    /**
     * Get API base URL
     */
    getBaseURL() {
      return this.api?.baseURL || 'http://127.0.0.1:8000/api';
    }

    /**
     * Check if in development mode
     */
    isDevelopment() {
      return window.location.hostname === 'localhost' ||
             window.location.hostname === '127.0.0.1';
    }

    /**
     * Handle API errors consistently
     */
    handleError(error, context = 'API call') {
      console.error(`React API Error [${context}]:`, error);

      // Return user-friendly error message
      if (error.message) {
        return error.message;
      }

      return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Create and export singleton instance
   */
  const reactAPI = new ReactAPIBridge();

  // Export to window for use in React components
  window.ReactAPI = reactAPI;

  // Also create a helper for React components
  window.useAPI = () => window.ReactAPI;

  console.log('✅ React API Bridge initialized');

})();