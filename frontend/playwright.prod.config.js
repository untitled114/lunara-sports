import { defineConfig, devices } from '@playwright/test'

// Live smoke check against a deployed site (no mocks, no screenshots: live data differs from
// the fixtures). Run from frontend/:
//
//   PLAYWRIGHT_BASE_URL=https://www.lunara-app.com npm run e2e:prod
if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error('Set PLAYWRIGHT_BASE_URL to the deployed site')

export default defineConfig({
  testDir: './e2e-prod',
  timeout: 60_000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results-prod',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    timezoneId: 'America/New_York',
    locale: 'en-US',
    colorScheme: 'dark',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
