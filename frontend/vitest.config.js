import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'webidl-conversions': path.resolve(__dirname, './src/test/webidl-conversions-mock.js'),
      'whatwg-url': path.resolve(__dirname, './src/test/whatwg-url-mock.js'),
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:3000',
      },
    },
    setupFiles: [
      './src/test/global-shims.js',  // MUST be first - provides polyfills before any imports
      './src/test/setup.js',
    ],
    testTimeout: 10000, // Increase timeout for component tests with user interactions
    css: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        execArgv: ['--require', './vitest-node-setup.cjs'],
      }
    },
    server: {
      deps: {
        inline: ['webidl-conversions', 'whatwg-url'],
      },
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{js,jsx}',
        '**/*.spec.{js,jsx}',
        '**/index.jsx',
        'vite.config.js',
        'vitest.config.js',
      ],
      lines: 80,
      functions: 70,
      branches: 70,
      statements: 80,
    },
  },
});