/* ===================== DASHBOARD UTILITIES ===================== */
/* Enhanced functionality for Lunara Dashboard */

/* ===================== DATA MANAGEMENT ===================== */
class DashboardData {
  constructor() {
    this.apiBase = '/api/v1'; // PLACEHOLDER: Replace with actual API base URL
    this.refreshInterval = 30000; // 30 seconds
    this.init();
  }

  init() {
    this.setupRefreshTimer();
    this.bindEventListeners();
  }

  // PLACEHOLDER: Implement with proper authentication headers and error handling
  async fetchStats() {
    try {
      // Simulated API call - replace with actual implementation
      const response = await fetch(`${this.apiBase}/dashboard/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch stats');
      return await response.json();
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      this.showError('Failed to load dashboard data');
      return null;
    }
  }

  // SECURITY: Implement secure token retrieval
  getAuthToken() {
    // PLACEHOLDER: Implement secure token storage and retrieval
    return localStorage.getItem('authToken') || '';
  }

  updateStatsDisplay(data) {
    if (!data) return;

    // Update stat values with animation
    const stats = ['active-projects', 'pending-payments', 'success-rate'];
    stats.forEach(stat => {
      const element = document.querySelector(`[data-stat="${stat}"] .stat-value`);
      if (element && data[stat] !== undefined) {
        this.animateCounter(element, data[stat]);
      }
    });
  }

  animateCounter(element, target) {
    const current = parseInt(element.textContent) || 0;
    const increment = (target - current) / 20;
    let count = current;

    const timer = setInterval(() => {
      count += increment;
      if ((increment > 0 && count >= target) || (increment < 0 && count <= target)) {
        element.textContent = target;
        clearInterval(timer);
      } else {
        element.textContent = Math.floor(count);
      }
    }, 50);
  }

  setupRefreshTimer() {
    setInterval(() => {
      this.refreshDashboard();
    }, this.refreshInterval);
  }

  async refreshDashboard() {
    const stats = await this.fetchStats();
    if (stats) {
      this.updateStatsDisplay(stats);
      this.updateLastRefresh();
    }
  }

  updateLastRefresh() {
    const timeElement = document.querySelector('.last-login time');
    if (timeElement) {
      const now = new Date();
      timeElement.setAttribute('datetime', now.toISOString());
      timeElement.textContent = `Last updated: ${now.toLocaleTimeString()}`;
    }
  }

  bindEventListeners() {
    // Handle notification clicks
    document.querySelector('.notification-btn')?.addEventListener('click', () => {
      this.handleNotificationClick();
    });

    // Handle project card clicks
    document.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          const projectId = card.dataset.projectId;
          this.handleProjectClick(projectId);
        }
      });
    });

    // Handle activity item clicks
    document.querySelectorAll('.activity-item').forEach(item => {
      item.addEventListener('click', () => {
        const activityId = item.dataset.activityId;
        this.handleActivityClick(activityId);
      });
    });
  }

  handleNotificationClick() {
    // PLACEHOLDER: Implement notification panel
    this.showToast('Notifications feature coming soon!', 'info');
  }

  handleProjectClick(projectId) {
    // PLACEHOLDER: Navigate to project detail page
    window.location.href = `project-detail.html?id=${projectId}`;
  }

  handleActivityClick(activityId) {
    // PLACEHOLDER: Handle activity item interaction
    // Handle activity interaction logic here
  }

  showError(message) {
    this.showToast(message, 'error');
  }

  showToast(message, type = 'info') {
    // Simple toast notification system
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Style the toast
    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      backgroundColor: type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#6366f1',
      color: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: '10000',
      transform: 'translateX(100%)',
      transition: 'transform 0.3s ease'
    });

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 100);

    // Remove after delay
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }
}

/* ===================== FORM ENHANCEMENTS ===================== */
class FormValidator {
  constructor(form) {
    this.form = form;
    this.init();
  }

  init() {
    this.setupValidation();
  }

  setupValidation() {
    const inputs = this.form.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('blur', () => this.validateField(input));
      input.addEventListener('input', () => this.clearError(input));
    });
  }

  validateField(field) {
    const value = field.value.trim();
    const type = field.type;
    const required = field.hasAttribute('required');

    // Clear previous errors
    this.clearError(field);

    // Check required fields
    if (required && !value) {
      this.showFieldError(field, 'This field is required');
      return false;
    }

    // Email validation
    if (type === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        this.showFieldError(field, 'Please enter a valid email address');
        return false;
      }
    }

    // Number validation
    if (type === 'number' && value) {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        this.showFieldError(field, 'Please enter a valid positive number');
        return false;
      }
    }

    // Text length validation
    if (field.hasAttribute('maxlength') && value.length > field.getAttribute('maxlength')) {
      this.showFieldError(field, `Maximum ${field.getAttribute('maxlength')} characters allowed`);
      return false;
    }

    return true;
  }

  showFieldError(field, message) {
    field.classList.add('error');

    let errorElement = field.parentNode.querySelector('.field-error');
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.className = 'field-error';
      errorElement.style.cssText = 'color: #ef4444; font-size: 0.8rem; margin-top: 0.25rem;';
      field.parentNode.appendChild(errorElement);
    }

    errorElement.textContent = message;
  }

  clearError(field) {
    field.classList.remove('error');
    const errorElement = field.parentNode.querySelector('.field-error');
    if (errorElement) {
      errorElement.remove();
    }
  }

  validateForm() {
    const inputs = this.form.querySelectorAll('input, textarea');
    let isValid = true;

    inputs.forEach(input => {
      if (!this.validateField(input)) {
        isValid = false;
      }
    });

    return isValid;
  }
}

/* ===================== PROGRESS ANIMATIONS ===================== */
class ProgressAnimator {
  static animateProgressBars() {
    const progressBars = document.querySelectorAll('.progress-fill');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const bar = entry.target;
          const width = bar.style.width;

          // Reset and animate
          bar.style.width = '0%';
          setTimeout(() => {
            bar.style.width = width;
          }, 100);

          observer.unobserve(bar);
        }
      });
    }, { threshold: 0.5 });

    progressBars.forEach(bar => observer.observe(bar));
  }

  static animateCounters() {
    const counters = document.querySelectorAll('.stat-value, .earnings-amount');

    counters.forEach(counter => {
      const target = parseInt(counter.textContent.replace(/[^0-9]/g, ''));
      const prefix = counter.textContent.replace(/[0-9]/g, '');

      let count = 0;
      const increment = target / 30;

      const timer = setInterval(() => {
        count += increment;
        if (count >= target) {
          counter.textContent = prefix + target.toLocaleString();
          clearInterval(timer);
        } else {
          counter.textContent = prefix + Math.floor(count).toLocaleString();
        }
      }, 50);
    });
  }
}

/* ===================== INITIALIZATION ===================== */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize dashboard data management
  const dashboard = new DashboardData();

  // Initialize form validation for the new project modal
  const projectForm = document.querySelector('.project-form');
  if (projectForm) {
    const validator = new FormValidator(projectForm);

    projectForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (validator.validateForm()) {
        // PLACEHOLDER: Implement actual project creation
        dashboard.showToast('Project created successfully!', 'success');
        closeModal('new-project');
      }
    });
  }

  // Animate elements on page load
  setTimeout(() => {
    ProgressAnimator.animateProgressBars();
    ProgressAnimator.animateCounters();
  }, 500);

  // Add loading states to buttons
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (!this.classList.contains('loading')) {
        this.classList.add('loading');
        this.style.opacity = '0.7';
        this.style.pointerEvents = 'none';

        setTimeout(() => {
          this.classList.remove('loading');
          this.style.opacity = '1';
          this.style.pointerEvents = 'auto';
        }, 1000);
      }
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + N for new project
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      showModal('new-project');
    }

    // Ctrl/Cmd + R for refresh (prevent default and use custom refresh)
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      dashboard.refreshDashboard();
      dashboard.showToast('Dashboard refreshed', 'success');
    }
  });
});

/* ===================== EXPORT FOR EXTERNAL USE ===================== */
window.DashboardUtils = {
  DashboardData,
  FormValidator,
  ProgressAnimator
};