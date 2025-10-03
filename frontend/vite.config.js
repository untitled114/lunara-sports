import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    // CSP configuration for development environment
    {
      name: 'dev-csp-headers',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Set permissive CSP for development (allows localhost API calls)
          res.setHeader('Content-Security-Policy',
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "img-src 'self' data: https:; " +
            "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 ws://localhost:3000 wss://localhost:3000; " +
            "frame-ancestors 'none';"
          );
          next();
        });
      }
    }
  ],
  optimizeDeps: {
    include: ['three'],
    exclude: []
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    rollupOptions: {
      output: {
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'three-vendor': ['three']
        }
      }
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    sourcemapIgnoreList: (sourcePath) => {
      // Ignore source maps from node_modules and browser extensions
      return sourcePath.includes('node_modules') ||
             sourcePath.includes('chrome-extension') ||
             sourcePath.includes('installHook') ||
             sourcePath.includes('passkeys') ||
             sourcePath.includes('nordpass');
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  }
});
