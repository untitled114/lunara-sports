// Serves every off-origin request the app makes from real captures (see fixtures/README.md)
// and stubs the WebSocket. Any request with no capture is recorded in `unmocked`, answered
// with a 599, and the spec fails on it — the test never reaches the network.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
const manifest = JSON.parse(readFileSync(join(FIXTURES, 'manifest.json'), 'utf8'))
const images = JSON.parse(readFileSync(join(FIXTURES, 'images', 'manifest.json'), 'utf8'))

// The production bundle calls api.lunara-app.com; a dev build falls back to localhost:8000.
const API_HOSTS = new Set(['api.lunara-app.com', 'localhost:8000', '127.0.0.1:8000'])

// The vite preview server playwright.config.js starts.
export const APP_HOST = '127.0.0.1:4173'

// 12:00 ET on Fri Sep 25, 2026: preseason, no games today, next game day Sat Oct 3.
export const FIXED_NOW = new Date('2026-09-25T16:00:00Z')

function serveFile(route, path, contentType, status = 200) {
  return route.fulfill({
    status,
    contentType,
    headers: { 'access-control-allow-origin': '*' },
    body: readFileSync(path),
  })
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ unmocked: string[] }>}
 */
export async function mockApi(page) {
  const unmocked = []

  // Every date read in the app (todayET, the scoreboard's ET "today") sees FIXED_NOW.
  await page.clock.setFixedTime(FIXED_NOW)

  // WebSocket stub: the socket opens and never sends anything, so the app shows the
  // captured REST data and nothing live can arrive mid-screenshot.
  await page.routeWebSocket(/.*/, () => {})

  await page.route('**/*', (route) => {
    const req = route.request()
    const url = new URL(req.url())

    if (url.protocol === 'data:' || url.protocol === 'blob:') return route.continue()
    if (url.host === APP_HOST) return route.continue()

    if (API_HOSTS.has(url.host)) {
      const entry = req.method() === 'GET' ? manifest[url.pathname + url.search] : undefined
      if (entry) return serveFile(route, join(FIXTURES, 'api', entry.file), entry.contentType, entry.status)
    } else if (url.host === 'fonts.googleapis.com' && url.pathname === '/css2') {
      return serveFile(route, join(FIXTURES, 'fonts', 'inter.css'), 'text/css')
    } else if (url.host === 'fonts.gstatic.com') {
      const file = url.pathname.replace(/^\//, '').replace(/\//g, '_')
      try {
        return serveFile(route, join(FIXTURES, 'fonts', file), 'font/woff2')
      } catch {
        // fall through to unmocked
      }
    } else if (url.host === 'a.espncdn.com') {
      const entry = images[url.pathname + url.search]
      if (entry) return serveFile(route, join(FIXTURES, 'images', entry.file), entry.contentType, entry.status)
      // Every headshot is a small combiner capture (getHeadshotUrl). There is no special
      // rule for full-size headshots any more: the app must never request one, so one that
      // shows up here is unmocked and fails the test.
    }

    unmocked.push(`${req.method()} ${req.url()}`)
    return route.fulfill({ status: 599, contentType: 'text/plain', body: 'unmocked in e2e' })
  })

  return { unmocked }
}
