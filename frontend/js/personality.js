// Particle Background System (2D + 3D Orb Background)

class ParticleSystem {
    constructor() {
        // 2D canvas
        this.canvas2D = null;
        this.ctx = null;
        this.particles = [];
        this.particleCount = 100;
        this.connectionDistance = 150;
        this.mouse = { x: 0, y: 0 };
        this.animationId = null;

        // 3D orb background
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.particle3D = null;
        this.orbParticleCount = 50000;

        this.init();
    }

    init() {
        this.createCanvas2D();
        this.createParticles();
        this.bindEvents();
        this.init3DOrbs();
        this.animate();
    }

    // ------------------ 2D PARTICLES ------------------
    createCanvas2D() {
        this.canvas2D = document.createElement('canvas');
        this.canvas2D.id = 'particle-bg';
        this.canvas2D.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            pointer-events: none;
        `;
        document.body.insertBefore(this.canvas2D, document.body.firstChild);
        this.ctx = this.canvas2D.getContext('2d');
        this.resize2D();
    }

    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas2D.width,
                y: Math.random() * this.canvas2D.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 2 + 1,
                opacity: Math.random() * 0.5 + 0.2
            });
        }
    }

    resize2D() {
        this.canvas2D.width = window.innerWidth;
        this.canvas2D.height = window.innerHeight;
        this.createParticles(); // optional: recreate particles on resize
    }

    updateParticles() {
        this.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;

            // Bounce off edges
            if (particle.x <= 0 || particle.x >= this.canvas2D.width) particle.vx *= -1;
            if (particle.y <= 0 || particle.y >= this.canvas2D.height) particle.vy *= -1;

            // Keep in bounds
            particle.x = Math.max(0, Math.min(this.canvas2D.width, particle.x));
            particle.y = Math.max(0, Math.min(this.canvas2D.height, particle.y));

            // Mouse interaction
            const dx = this.mouse.x - particle.x;
            const dy = this.mouse.y - particle.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            if(distance < 100){
                const force = (100 - distance)/100;
                particle.x -= dx * force * 0.01;
                particle.y -= dy * force * 0.01;
            }
        });

        
    }

    drawParticles() {
        this.particles.forEach(particle => {
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity * 0.8})`;
            this.ctx.fill();
        });
    }

    drawConnections() {
        for(let i=0; i<this.particles.length; i++){
            for(let j=i+1; j<this.particles.length; j++){
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                if(distance < this.connectionDistance){
                    const opacity = (this.connectionDistance - distance)/this.connectionDistance * 0.2;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.strokeStyle = `rgba(147, 197, 253, ${opacity})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.stroke();
                }
            }
        }
    }

    render2D() {
        this.ctx.clearRect(0, 0, this.canvas2D.width, this.canvas2D.height);
        this.drawConnections();
        this.drawParticles();
    }

    // ------------------ 3D ORB BACKGROUND ------------------
    init3DOrbs() {
        // Create canvas dynamically
        const orbCanvas = document.createElement('canvas');
        orbCanvas.id = 'orb-bg';
        orbCanvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -2;
            pointer-events: none;
        `;
        document.body.insertBefore(orbCanvas, this.canvas2D);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas: orbCanvas, antialias:true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Geometry
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.orbParticleCount * 3);
        for(let i=0; i<this.orbParticleCount; i++){
            positions[i*3] = (Math.random()-0.5)*50;
            positions[i*3+1] = (Math.random()-0.5)*50;
            positions[i*3+2] = (Math.random()-0.5)*50;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            size: 0.02,
            color: 0x9370db,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthTest: false
        });

        this.particle3D = new THREE.Points(geometry, material);
        this.scene.add(this.particle3D);

        this.camera.position.z = 20;

        // Handle resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth/window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.resize2D();
        });
    }

    animate() {
        // 2D particles
        this.updateParticles();
        this.render2D();

        // 3D orbs
        if(this.particle3D){
            this.particle3D.rotation.y += 0.0005;
            this.particle3D.rotation.x += 0.0003;
            this.renderer.render(this.scene, this.camera);
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resize2D());

        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        document.addEventListener('mouseleave', () => {
            this.mouse.x = -1000;
            this.mouse.y = -1000;
        });
    }

    destroy() {
        if(this.animationId) cancelAnimationFrame(this.animationId);
        if(this.canvas2D) this.canvas2D.remove();
        if(this.renderer && this.renderer.domElement) this.renderer.domElement.remove();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.particleSystem = new ParticleSystem();
});

// Clean up
window.addEventListener('beforeunload', () => {
    if(window.particleSystem) window.particleSystem.destroy();
});