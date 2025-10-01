/**
 * Legacy JavaScript imports for Vite bundling
 *
 * This file imports all vanilla JS modules in the correct execution order.
 * These files were previously loaded via individual <script> tags in index.html.
 *
 * NOTE: Some files use global variables and IIFE patterns. They will execute
 * immediately when imported, maintaining their original behavior.
 */

// 1. Core API and Navigation (must load first)
import '../js/api.js';
import '../js/react-api-bridge.js';
import '../js/navigation.js';

// 2. Three.js particles (requires Three.js CDN to be loaded first)
// NOTE: Three.js is still loaded via CDN. To fully optimize, install via npm:
// npm install three
// Then update particles.js to: import * as THREE from 'three';
import '../js/particles.js';

// 3. UI and Interactions
import '../js/ui.js';
import '../js/button_logic.js';
import '../js/scroll_animation.js';
import '../js/personality.js';

// Legacy scripts are now bundled and will execute in order
console.log('✅ Legacy JavaScript assets bundled via Vite');
