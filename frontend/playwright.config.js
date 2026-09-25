import { defineConfig, devices } from '@playwright/test'

// Screenshot pixels depend on the OS and its fonts, so the baselines are generated, and CI
// runs, inside the pinned image mcr.microsoft.com/playwright:v1.63.0-noble (the exact
// @playwright/test version in package.json). To regenerate from frontend/:
//
//   docker run --rm -v "$PWD/..":/work -w /work/frontend mcr.microsoft.com/playwright:v1.63.0-noble \
//     bash -c 'npm ci && npx playwright test --update-snapshots'
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' },
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    timezoneId: 'America/New_York',
    locale: 'en-US',
    colorScheme: 'dark',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // The production bundle, served as Vercel would serve it (SPA fallback included).
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
