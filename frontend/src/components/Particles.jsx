import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ParticleBackground = () => {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current) {
            console.error('[Particles] Container ref is null');
            return;
        }

        console.log('[Particles] Starting initialization...');

        let scene, camera, renderer, particles;
        let animationFrameId;

        try {
            // Scene
            scene = new THREE.Scene();
            console.log('[Particles] Scene created');

            // Camera
            camera = new THREE.PerspectiveCamera(
                75,
                window.innerWidth / window.innerHeight,
                0.1,
                1000
            );
            camera.position.z = 50;
            console.log('[Particles] Camera created at z=50');

            // Renderer
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true
            });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setClearColor(0x000000, 0);

            // Add canvas to DOM
            containerRef.current.appendChild(renderer.domElement);
            console.log('[Particles] Renderer added to DOM');
            console.log('[Particles] Canvas size:', renderer.domElement.width, 'x', renderer.domElement.height);

            // Create particles
            const geometry = new THREE.BufferGeometry();
            const particleCount = 1500;
            const positions = new Float32Array(particleCount * 3);
            const colors = new Float32Array(particleCount * 3);

            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                positions[i3] = (Math.random() - 0.5) * 100;      // x
                positions[i3 + 1] = (Math.random() - 0.5) * 100;  // y
                positions[i3 + 2] = (Math.random() - 0.5) * 100;  // z

                // Beautiful color gradient: cyan to purple to blue
                const hue = 0.5 + Math.random() * 0.2; // 0.5-0.7 (cyan to blue)
                const color = new THREE.Color();
                color.setHSL(hue, 0.8, 0.6);
                colors[i3] = color.r;
                colors[i3 + 1] = color.g;
                colors[i3 + 2] = color.b;
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            // Material - Beautiful glowing particles
            const material = new THREE.PointsMaterial({
                size: 3,
                vertexColors: true,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending,
                sizeAttenuation: false
            });

            particles = new THREE.Points(geometry, material);
            scene.add(particles);
            console.log('[Particles] Particle system created with', particleCount, 'particles');

            // Animation loop with smooth rotation
            const animate = () => {
                animationFrameId = requestAnimationFrame(animate);

                // Smooth, gentle rotation
                particles.rotation.y += 0.0005;
                particles.rotation.x += 0.0002;

                renderer.render(scene, camera);
            };
            animate();
            console.log('[Particles] Animation started - particles should be visible!');

            // Resize handler
            const handleResize = () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            };
            window.addEventListener('resize', handleResize);

            // Cleanup
            return () => {
                console.log('[Particles] Cleaning up...');
                window.removeEventListener('resize', handleResize);
                cancelAnimationFrame(animationFrameId);

                if (containerRef.current && renderer.domElement) {
                    containerRef.current.removeChild(renderer.domElement);
                }

                geometry.dispose();
                material.dispose();
                renderer.dispose();
            };
        } catch (error) {
            console.error('[Particles] Error during initialization:', error);
        }
    }, []);

    return (
        <div
            ref={containerRef}
            id="particle-container"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: -1,
                pointerEvents: 'none'
            }}
        />
    );
};

export default ParticleBackground;