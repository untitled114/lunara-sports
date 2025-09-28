// user-profile.js - Phase 2: Extracted and Modularized JavaScript

class UserProfileManager {
  constructor() {
    this.currentTab = 'activity';
    this.modals = new Map();
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadTabContent();
    this.setupModals();
    this.animateProgressBars();
  }

  setupEventListeners() {
    // Header scroll effect
    this.setupHeaderScroll();
    
    // Mobile menu
    this.setupMobileMenu();
    
    // Tab functionality
    this.setupTabs();
    
    // Avatar upload
    this.setupAvatarUpload();
    
    // Quick actions
    this.setupQuickActions();
    
    // Logo click
    document.querySelector('.logo')?.addEventListener('click', () => {
      window.location.href = '#home';
    });

    // Button loading states
    this.setupButtonStates();
  }

  setupHeaderScroll() {
    const header = document.getElementById('header');
    if (!header) return;

    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }

  setupMobileMenu() {
    const mobileToggle = document.getElementById('mobile-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (!mobileToggle || !mobileMenu) return;

    mobileToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('active');
    });
  }

  setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });
  }

  switchTab(tabName) {
    // Remove active class from all buttons and contents
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to clicked button and corresponding content
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(tabName)?.classList.add('active');
    
    this.currentTab = tabName;
    this.loadTabContent(tabName);
    this.animateProgressBars();
  }

  loadTabContent(tabName = 'activity') {
    const container = document.getElementById(`${tabName}-container`);
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';
    
    switch (tabName) {
      case 'activity':
        this.loadActivityContent(container);
        break;
      case 'projects':
        this.loadProjectsContent(container);
        break;
      case 'reviews':
        this.loadReviewsContent(container);
        break;
      case 'analytics':
        this.loadAnalyticsContent(container);
        break;
      case 'payments':
        this.loadPaymentsContent(container);
        break;
    }
  }

  loadActivityContent(container) {
    const activities = [
      {
        title: 'E-commerce Dashboard',
        date: '2 days ago',
        status: 'completed',
        description: 'Modern React dashboard with real-time analytics and inventory management.',
        amount: '$1,500',
        client: 'TechCorp',
        progress: 100
      },
      {
        title: 'Mobile Banking App',
        date: '5 days ago',
        status: 'in-progress',
        description: 'Flutter-based mobile app with biometric authentication and transaction tracking.',
        amount: '$2,800',
        client: 'FinanceFlow',
        progress: 75
      },
      {
        title: 'Brand Identity Redesign',
        date: '1 week ago',
        status: 'completed',
        description: 'Complete visual identity overhaul including logo, website, and marketing materials.',
        amount: '$950',
        client: 'StartupXYZ',
        progress: 100
      },
      {
        title: 'API Integration Project',
        date: '2 weeks ago',
        status: 'pending',
        description: 'RESTful API development and third-party service integrations for logistics platform.',
        amount: '$1,200',
        client: 'LogiTech',
        progress: 90
      }
    ];

    activities.forEach(activity => {
      container.appendChild(this.createActivityCard(activity));
    });
  }

  loadProjectsContent(container) {
    const projects = [
      {
        title: 'Healthcare Portal',
        date: '1 month ago',
        status: 'completed',
        description: 'Patient management system with appointment scheduling and medical records.',
        amount: '$3,200',
        client: 'MedCare Plus'
      },
      {
        title: 'Social Media Analytics',
        date: '6 weeks ago',
        status: 'completed',
        description: 'Instagram and Twitter analytics dashboard with sentiment analysis.',
        amount: '$1,800',
        client: 'SocialBoost'
      }
    ];

    projects.forEach(project => {
      container.appendChild(this.createActivityCard(project));
    });
  }

  loadReviewsContent(container) {
    const reviews = [
      {
        name: 'Sarah Johnson',
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b8cd3eda?w=50&h=50&fit=crop&crop=face',
        rating: 5,
        comment: '"Exceptional work on our e-commerce platform. Alex delivered beyond expectations with clean code and intuitive design."',
        project: 'E-commerce Dashboard',
        date: '3 days ago'
      },
      {
        name: 'Mike Chen',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face',
        rating: 5,
        comment: '"Professional, responsive, and delivered on time. The API integration was flawless and well-documented."',
        project: 'API Integration',
        date: '1 week ago'
      }
    ];

    reviews.forEach(review => {
      container.appendChild(this.createReviewCard(review));
    });
  }

  loadAnalyticsContent(container) {
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
        <div class="activity-card">
          <h3 style="margin-bottom: 1rem;">Monthly Earnings</h3>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
            <span style="font-size: 2rem; font-weight: 700; color: var(--success);">$4,200</span>
            <span style="color: var(--success); font-size: 0.9rem;">↗ +18%</span>
          </div>
          <div class="progress-bar" style="margin-bottom: 0.5rem;">
            <div class="progress-bar-inner" data-width="84"></div>
          </div>
          <p style="color: var(--text-muted); font-size: 0.8rem;">84% of monthly goal ($5,000)</p>
        </div>
        <div class="activity-card">
          <h3 style="margin-bottom: 1rem;">Client Satisfaction</h3>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
            <span style="font-size: 2rem; font-weight: 700; color: var(--warning);">4.9/5</span>
            <span style="color: var(--success); font-size: 0.9rem;">↗ +0.1</span>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <div style="flex: 1; text-align: center;">
              <div style="font-size: 1.2rem; font-weight: 600;">47</div>
              <div style="color: var(--text-muted); font-size: 0.8rem;">Reviews</div>
            </div>
            <div style="flex: 1; text-align: center;">
              <div style="font-size: 1.2rem; font-weight: 600;">98%</div>
              <div style="color: var(--text-muted); font-size: 0.8rem;">Positive</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  loadPaymentsContent(container) {
    const payments = [
      {
        type: 'Payment Received',
        amount: '+$1,500',
        description: 'E-commerce Dashboard - Final payment',
        date: 'Dec 12, 2024',
        method: 'Bank Transfer'
      },
      {
        type: 'Milestone Payment',
        amount: '+$1,400',
        description: 'Mobile Banking App - 50% milestone',
        date: 'Dec 8, 2024',
        method: 'SafeSend Wallet'
      }
    ];

    payments.forEach(payment => {
      container.appendChild(this.createPaymentCard(payment));
    });
  }

  createActivityCard(activity) {
    const card = document.createElement('div');
    card.className = 'activity-card';
    
    card.innerHTML = `
      <div class="activity-card-header">
        <div>
          <h3>${activity.title}</h3>
          <div class="date">${activity.date}</div>
        </div>
        <span class="badge ${activity.status}">${this.formatStatus(activity.status)}</span>
      </div>
      <p>${activity.description}</p>
      <div class="activity-meta">
        <span class="activity-amount">${activity.amount}</span>
        <span style="color: var(--text-muted); font-size: 0.8rem;">Client: ${activity.client}</span>
      </div>
      ${activity.progress ? `
        <div class="progress-container">
          <div class="progress-label">
            <span>Progress</span>
            <span>${activity.progress}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-bar-inner" data-width="${activity.progress}"></div>
          </div>
        </div>
      ` : ''}
    `;
    
    return card;
  }

  createReviewCard(review) {
    const card = document.createElement('div');
    card.className = 'activity-card';
    
    const stars = '⭐'.repeat(review.rating);
    
    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
        <img src="${review.avatar}" alt="${review.name}" style="width: 50px; height: 50px; border-radius: 50%; border: 2px solid var(--accent);">
        <div>
          <h4>${review.name}</h4>
          <div style="color: var(--warning);">${stars}</div>
        </div>
      </div>
      <p>${review.comment}</p>
      <div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 1rem;">${review.project} • ${review.date}</div>
    `;
    
    return card;
  }

  createPaymentCard(payment) {
    const card = document.createElement('div');
    card.className = 'activity-card';
    
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3>${payment.type}</h3>
        <span style="color: var(--success); font-weight: 600;">${payment.amount}</span>
      </div>
      <p>${payment.description}</p>
      <div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.5rem;">${payment.date} • ${payment.method}</div>
    `;
    
    return card;
  }

  formatStatus(status) {
    const statusMap = {
      'completed': 'Completed',
      'in-progress': 'In Progress',
      'pending': 'Review'
    };
    return statusMap[status] || status;
  }

  setupModals() {
    const modalData = {
      'projects': {
        title: 'Project Statistics',
        content: [
          ['Completed Projects', '21'],
          ['Active Projects', '3'],
          ['Average Project Value', '$1,250'],
          ['Success Rate', '98%']
        ]
      },
      'earnings': {
        title: 'Earnings Breakdown',
        content: [
          ['This Month', '$4,200', 'var(--success)'],
          ['Last Month', '$3,100'],
          ['Year to Date', '$18,500'],
          ['Pending Payments', '$2,100', 'var(--warning)']
        ]
      },
      'rating': {
        title: 'Rating Details',
        content: [
          ['5 Stars', '40', '85%'],
          ['4 Stars', '7', '15%'],
          ['3 Stars or below', '0', '0%']
        ]
      },
      'completion': {
        title: 'Completion Statistics',
        content: [
          ['On-Time Deliveries', '23/24', 'var(--success)'],
          ['Average Delivery Time', '2.3 days early'],
          ['Revision Requests', '< 5% of projects']
        ]
      }
    };

    Object.entries(modalData).forEach(([id, data]) => {
      this.createModal(id, data);
    });
  }

  createModal(id, data) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = `${id}-modal`;
    
    let contentHTML = '';
    data.content.forEach((item, index) => {
      const borderStyle = index < data.content.length - 1 ? 'border-bottom: 1px solid var(--border-color);' : '';
      const color = item[2] ? `style="color: ${item[2]};"` : '';
      
      if (id === 'rating' && item[2]) {
        // Special handling for rating bars
        contentHTML += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; ${borderStyle}">
            <span>${item[0]}</span>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div style="width: 100px; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
                <div style="width: ${item[2]}; height: 100%; background: var(--success);"></div>
              </div>
              <span>${item[1]}</span>
            </div>
          </div>
        `;
      } else {
        contentHTML += `
          <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; ${borderStyle}">
            <span>${item[0]}</span>
            <strong ${color}>${item[1]}</strong>
          </div>
        `;
      }
    });
    
    modal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" onclick="closeModal('${id}')">&times;</button>
        <h2 style="margin-bottom: 1rem;">${data.title}</h2>
        <div style="display: grid; gap: 1rem;">
          ${contentHTML}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  animateProgressBars() {
    // Initial animation
    setTimeout(() => {
      const bars = document.querySelectorAll('.progress-bar-inner');
      bars.forEach(bar => {
        const width = bar.dataset.width;
        bar.style.width = width + '%';
      });
    }, 500);
  }

  setupAvatarUpload() {
    const avatarUpload = document.getElementById('avatar-upload');
    if (!avatarUpload) return;

    avatarUpload.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            avatarUpload.src = e.target.result;
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    });
  }

  setupQuickActions() {
    document.querySelectorAll('.quick-action').forEach(action => {
      action.addEventListener('click', (e) => {
        const title = e.currentTarget.getAttribute('title');
        
        // Add haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        
        console.log(`${title} clicked`);
        // You can implement specific actions here
      });
    });
  }

  setupButtonStates() {
    document.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        if (this.classList.contains('btn-primary')) {
          this.style.opacity = '0.7';
          setTimeout(() => {
            this.style.opacity = '1';
          }, 1000);
        }
      });
    });
  }
}

// Modal functions (global for onclick handlers)
function showModal(modalId) {
  const modal = document.getElementById(`${modalId}-modal`);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(`${modalId}-modal`);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
  }
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
    document.body.style.overflow = 'auto';
  }
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const activeModal = document.querySelector('.modal.active');
    if (activeModal) {
      activeModal.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  }
});

// Intersection observer for animations
const userProfileObserverOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.animationPlayState = 'running';
    }
  });
}, userProfileObserverOptions);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.userProfileManager = new UserProfileManager();
  
  // Observe cards for animations
  document.querySelectorAll('.stat-card, .activity-card').forEach(el => {
    observer.observe(el);
  });
});

