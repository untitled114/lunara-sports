/**
 * Enhanced Particle Background System
 * Optimized for performance with graceful degradation and error handling
 */

(function() {
  'use strict';

  class ParticleSystem {
    constructor() {
      // Canvas properties
      this.canvas = null;
      this.ctx = null;
      this.particles = [];
      this.mouse = { x: 0, y: 0 };
      this.animationId = null;
      this.isActive = true;
      this.isVisible = true;

      // Configuration based on device capabilities
      this.config = {
        particleCount: this.getOptimalParticleCount(),
        connectionDistance: window.innerWidth < 768 ? 80 : 120,
        particleSpeed: 0.5,
        mouseRadius: 100,
        maxConnections: 3,
        enable3D: this.shouldEnable3D(),
        reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      };

      // Performance monitoring
      this.lastFrameTime = 0;
      this.frameCount = 0;
      this.averageFPS = 60;

      this.init();
    }

    /**
     * Determine optimal particle count based on device
     */
    getOptimalParticleCount() {
      const width = window.innerWidth;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) return 20;
      if (width < 768) return 30;
      if (width < 1024) return 50;
      return 80;
    }

    /**
     * Determine if 3D should be enabled
     */
    shouldEnable3D() {
      return window.innerWidth >= 1024 &&
             typeof THREE !== 'undefined' &&
             !this.config.reduceMotion;
    }

    /**
     * Initialize the particle system
     */
    init() {
      try {
        this.createCanvas();
        this.createParticles();
        this.bindEvents();

        if (this.config.enable3D) {
          this.init3DBackground();
        }

        this.animate();
        console.log('particles.js: Particle system initialized successfully');
      } catch (error) {
        console.error('particles.js: Initialization failed:', error);
        this.fallbackToStatic();
      }
    }

    /**
     * Create 2D canvas for particles
     */
    createCanvas() {
      // Remove existing canvas if it exists
      const existingCanvas = document.getElementById('particle-canvas');
      if (existingCanvas) {
        existingCanvas.remove();
      }

      this.canvas = document.createElement('canvas');
      this.canvas.id = 'particle-canvas';
      this.canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: -1;
        pointer-events: none;
        opacity: 0.8;
        mix-blend-mode: screen;
      `;

      document.body.insertBefore(this.canvas, document.body.firstChild);
      this.ctx = this.canvas.getContext('2d');

      if (!this.ctx) {
        throw new Error('Canvas 2D context not supported');
      }

      this.resize();
    }

    /**
     * Create particle objects
     */
    createParticles() {
      this.particles = [];

      for (let i = 0; i < this.config.particleCount; i++) {
        this.particles.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height,
          vx: (Math.random() - 0.5) * this.config.particleSpeed,
          vy: (Math.random() - 0.5) * this.config.particleSpeed,
          radius: Math.random() * 2 + 1,
          opacity: Math.random() * 0.6 + 0.2,
          connections: 0
        });
      }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
      // Mouse movement
      document.addEventListener('mousemove', (e) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
      }, { passive: true });

      // Window resize
      window.addEventListener('resize', () => {
        this.resize();
      }, { passive: true });

      // Visibility change (pause when tab is hidden)
      document.addEventListener('visibilitychange', () => {
        this.isVisible = !document.hidden;
        if (this.isVisible && this.isActive) {
          this.animate();
        }
      });

      // Reduced motion preference change
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      mediaQuery.addListener((e) => {
        this.config.reduceMotion = e.matches;
        if (e.matches) {
          this.stop();
        } else {
          this.start();
        }
      });
    }

    /**
     * Handle canvas resize
     */
    resize() {
      if (!this.canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();

      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;

      this.ctx.scale(dpr, dpr);
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
    }

    /**
     * Update particle positions
     */
    updateParticles() {
      this.particles.forEach(particle => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Bounce off edges
        if (particle.x < 0 || particle.x > this.canvas.width / (window.devicePixelRatio || 1)) {
          particle.vx *= -1;
        }
        if (particle.y < 0 || particle.y > this.canvas.height / (window.devicePixelRatio || 1)) {
          particle.vy *= -1;
        }

        // Reset connection count
        particle.connections = 0;

        // Mouse interaction
        const dx = this.mouse.x - particle.x;
        const dy = this.mouse.y - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.config.mouseRadius) {
          const force = (this.config.mouseRadius - distance) / this.config.mouseRadius;
          particle.x -= dx * force * 0.01;
          particle.y -= dy * force * 0.01;
        }
      });
    }

    /**
     * Render particles with glow effect
     */
    renderParticles() {
      this.particles.forEach(particle => {
        // Create glow effect
        const gradient = this.ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.radius * 4
        );

        // Enhanced color palette for more orb-like appearance
        const colors = [
          `rgba(147, 197, 253, ${particle.opacity * 0.8})`, // Blue
          `rgba(139, 92, 246, ${particle.opacity * 0.6})`,  // Purple
          `rgba(6, 182, 212, ${particle.opacity * 0.7})`    // Cyan
        ];

        const colorIndex = Math.floor(particle.x * particle.y) % colors.length;
        const mainColor = colors[colorIndex];

        gradient.addColorStop(0, mainColor);
        gradient.addColorStop(0.4, mainColor.replace(/[\d\.]+\)$/g, `${particle.opacity * 0.3})`));
        gradient.addColorStop(1, 'rgba(147, 197, 253, 0)');

        // Draw glow
        this.ctx.beginPath();
        this.ctx.arc(particle.x, particle.y, particle.radius * 4, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        // Draw core particle
        this.ctx.beginPath();
        this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = mainColor;
        this.ctx.fill();

        // Add bright center dot
        this.ctx.beginPath();
        this.ctx.arc(particle.x, particle.y, particle.radius * 0.5, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity * 0.8})`;
        this.ctx.fill();
      });
    }

    /**
     * Render connections between nearby particles
     */
    renderConnections() {
      for (let i = 0; i < this.particles.length; i++) {
        const particleA = this.particles[i];

        if (particleA.connections >= this.config.maxConnections) continue;

        for (let j = i + 1; j < this.particles.length; j++) {
          const particleB = this.particles[j];

          if (particleB.connections >= this.config.maxConnections) continue;

          const dx = particleA.x - particleB.x;
          const dy = particleA.y - particleB.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < this.config.connectionDistance) {
            const opacity = (1 - distance / this.config.connectionDistance) * 0.3;

            this.ctx.beginPath();
            this.ctx.moveTo(particleA.x, particleA.y);
            this.ctx.lineTo(particleB.x, particleB.y);
            this.ctx.strokeStyle = `rgba(147, 197, 253, ${opacity})`;
            this.ctx.lineWidth = 0.5;
            this.ctx.stroke();

            particleA.connections++;
            particleB.connections++;
          }
        }
      }
    }

    /**
     * Main animation loop
     */
    animate() {
      if (!this.isActive || !this.isVisible || this.config.reduceMotion) {
        return;
      }

      const currentTime = performance.now();
      const deltaTime = currentTime - this.lastFrameTime;

      // Limit frame rate for performance
      if (deltaTime >= 1000 / 60) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.updateParticles();
        this.renderConnections();
        this.renderParticles();

        this.lastFrameTime = currentTime;
        this.frameCount++;

        // Monitor performance every 60 frames
        if (this.frameCount % 60 === 0) {
          this.averageFPS = 1000 / deltaTime;

          // Reduce particle count if performance is poor
          if (this.averageFPS < 30 && this.particles.length > 20) {
            this.particles.splice(-5);
            console.log('particles.js: Reduced particle count for better performance');
          }
        }
      }

      this.animationId = requestAnimationFrame(() => this.animate());
    }

    /**
     * Initialize 3D background (optional)
     */
    init3DBackground() {
      if (typeof THREE === 'undefined') {
        console.warn('particles.js: THREE.js not loaded, skipping 3D background');
        return;
      }

      try {
        // Create 3D canvas
        const canvas3D = document.createElement('canvas');
        canvas3D.id = 'particle-3d-canvas';
        canvas3D.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: -2;
          pointer-events: none;
          opacity: 0.3;
        `;

        document.body.insertBefore(canvas3D, this.canvas);

        // Initialize Three.js scene
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
          canvas: canvas3D,
          antialias: false,
          alpha: true
        });

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 0);

        // Create particle geometry
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.config.orbParticleCount * 3);

        for (let i = 0; i < this.config.orbParticleCount * 3; i += 3) {
          positions[i] = (Math.random() - 0.5) * 2000;
          positions[i + 1] = (Math.random() - 0.5) * 2000;
          positions[i + 2] = (Math.random() - 0.5) * 2000;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
          color: 0x93c5fd,
          size: 2,
          transparent: true,
          opacity: 0.6
        });

        this.particle3D = new THREE.Points(geometry, material);
        this.scene.add(this.particle3D);
        this.camera.position.z = 1000;

        // Animate 3D particles
        const animate3D = () => {
          if (this.isActive && this.isVisible && !this.config.reduceMotion) {
            this.particle3D.rotation.x += 0.0005;
            this.particle3D.rotation.y += 0.001;
            this.renderer.render(this.scene, this.camera);
          }
          requestAnimationFrame(animate3D);
        };

        animate3D();
        console.log('particles.js: 3D background initialized');
      } catch (error) {
        console.warn('particles.js: Failed to initialize 3D background:', error);
      }
    }

    /**
     * Start the particle system
     */
    start() {
      this.isActive = true;
      if (this.isVisible) {
        this.animate();
      }
    }

    /**
     * Stop the particle system
     */
    stop() {
      this.isActive = false;
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    }

    /**
     * Fallback to static background if particles fail
     */
    fallbackToStatic() {
      console.log('particles.js: Using static background fallback');
      document.body.style.background = 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%)';
    }

    /**
     * Cleanup method
     */
    destroy() {
      this.stop();

      if (this.canvas) {
        this.canvas.remove();
      }

      const canvas3D = document.getElementById('particle-3d-canvas');
      if (canvas3D) {
        canvas3D.remove();
      }

      this.particles = [];
      console.log('particles.js: Particle system destroyed');
    }
  }

  /**
   * Initialize particle system when DOM is ready
   */
  function init() {
    // Check if particle system should be enabled
    const shouldEnable = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!shouldEnable) {
      console.log('particles.js: Particles disabled due to reduced motion preference');
      return;
    }

    try {
      window.particleSystem = new ParticleSystem();
    } catch (error) {
      console.error('particles.js: Failed to initialize particle system:', error);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging
  if (typeof window !== 'undefined') {
    window.ParticleSystem = ParticleSystem;
  }

})();