import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

// Check for reduced motion preference once
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ParticleBackground = () => {
    const canvasRef = useRef(null);
    const animationFrameIdRef = useRef();

    // Use useCallback for the animation loop
    const animate = useCallback((scene, camera, renderer, particles) => {
        // Stop if reduced motion is preferred
        if (prefersReducedMotion) {
            cancelAnimationFrame(animationFrameIdRef.current);
            return;
        }

        const time = Date.now() * 0.00005;

        // Rotate the particles slightly for a subtle 3D effect
        if (particles) {
            particles.rotation.y = time * 0.3;
            particles.rotation.x = time * 0.1;
        }

        // Move the camera slightly for a subtle 'drift' effect
        camera.position.x = Math.sin(time * 0.5) * 10;
        camera.position.y = Math.cos(time * 0.3) * 10;
        // Keep z position stable to maintain view of particles
        camera.position.z = 200;
        
        renderer.render(scene, camera);
        animationFrameIdRef.current = requestAnimationFrame(() => animate(scene, camera, renderer, particles));
    }, []);

    useEffect(() => {
        if (prefersReducedMotion) {
            console.log('[Particles] Disabled due to reduced-motion preference.');
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        console.log('[Particles] Initializing THREE.js 3D background...');

        // 1. Setup Scene, Camera, and Renderer
        const width = window.innerWidth;
        const height = window.innerHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, width / height, 1, 1000);
        camera.position.z = 200;

        const renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            antialias: true,
            alpha: true
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2 for performance
        renderer.setClearColor(0x000000, 0);

        // 2. Create Particle Geometry
        const particlesGeometry = new THREE.BufferGeometry();
        const particleCount = width < 768 ? 500 : 2000;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const color = new THREE.Color();

        console.log(`[Particles] Creating ${particleCount} particles`);

        for (let i = 0; i < particleCount; i++) {
            // Position particles in front of camera (camera is at z=200)
            // Spread them in a visible range: x/y: -300 to 300, z: -100 to 100
            positions[i * 3 + 0] = (Math.random() - 0.5) * 600; // x: -300 to 300
            positions[i * 3 + 1] = (Math.random() - 0.5) * 600; // y: -300 to 300
            positions[i * 3 + 2] = (Math.random() - 0.5) * 400; // z: -200 to 200

            // Bright, high-contrast colors for visibility
            const hue = Math.random() * 0.2 + 0.5; // 0.5-0.7 (cyan to blue)
            const saturation = 0.8 + Math.random() * 0.2; // 0.8-1.0 (vibrant)
            const lightness = 0.6 + Math.random() * 0.3; // 0.6-0.9 (bright)

            color.setHSL(hue, saturation, lightness);
            colors[i * 3 + 0] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // 3. Create Material - Large and bright for visibility
        const particlesMaterial = new THREE.PointsMaterial({
            size: 4, // Large for visibility
            sizeAttenuation: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexColors: true,
            transparent: true,
            opacity: 0.9
        });

        console.log('[Particles] Material created:', {
            size: particlesMaterial.size,
            opacity: particlesMaterial.opacity
        });

        const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
        scene.add(particleSystem);

        console.log('[Particles] Particle system added to scene');
        console.log('[Particles] Camera position:', camera.position);
        console.log('[Particles] Canvas size:', { width, height });
        console.log('[Particles] Renderer size:', renderer.getSize(new THREE.Vector2()));

        // DEBUG: Add a visible test cube to confirm rendering is working
        const testGeometry = new THREE.BoxGeometry(20, 20, 20);
        const testMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true
        });
        const testCube = new THREE.Mesh(testGeometry, testMaterial);
        testCube.position.set(0, 0, 0); // At origin, visible from camera
        scene.add(testCube);
        console.log('[Particles] DEBUG: Red wireframe cube added at origin for visibility test');

        // 4. Handle Resizing
        const onWindowResize = () => {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;

            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();

            renderer.setSize(newWidth, newHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        };
        
        window.addEventListener('resize', onWindowResize, { passive: true });

        // 5. Start Animation Loop
        animate(scene, camera, renderer, particleSystem);

        // 6. Cleanup Function
        return () => {
            console.log('[Particles] Cleanup: Disposing of THREE.js assets.');
            
            window.removeEventListener('resize', onWindowResize);
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
            }
            particlesGeometry.dispose();
            particlesMaterial.dispose();
            renderer.dispose();
        };
    }, [animate]);

    if (prefersReducedMotion) {
        return null;
    }

    return (
        <canvas 
            ref={canvasRef}
            id="particle-3d-canvas"
            className="particle-background"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: -1,
                pointerEvents: 'none',
            }}
        />
    );
};

export default ParticleBackground;