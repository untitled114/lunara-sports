import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi } from './mockApi'

// Every route in src/App.jsx. The detail pages use real captured records: team MIA,
// player 4066261 (Bam Adebayo), final game 401811037 (OKC @ DEN) and the scheduled
// MIA @ TOR opener 401902644.
const PAGES = [
  { path: '/', name: 'home' },
  { path: '/scoreboard', name: 'scoreboard-today', cards: true },
  { path: '/scoreboard?date=2026-10-03', name: 'scoreboard-oct-3', cards: true },
  { path: '/game/401811037', name: 'game-final' },
  { path: '/game/401902644', name: 'game-scheduled' },
  // Standings is tables, not cards: its non-vacuous check is on the table frames.
  { path: '/standings', name: 'standings', frames: 'div.rounded-lg.border:has(> table)' },
  { path: '/teams', name: 'teams', cards: true },
  { path: '/team/MIA', name: 'team-mia' },
  { path: '/schedule', name: 'schedule' },
  // ~500 roster rows (a 25,000px-tall page at 390): the shot keeps the top 2,000px.
  { path: '/players', name: 'players', clipHeight: 2000 },
  { path: '/player/4066261', name: 'player' },
  { path: '/stats', name: 'stats', cards: true },
  { path: '/picks', name: 'picks' },
  { path: '/admin', name: 'admin' },
  { path: '/terms', name: 'terms' },
  // Its legal text names "telemetry services", so it skips the banned-word check only.
  { path: '/privacy', name: 'privacy', legalText: true },
]

const BANNED = /\b(telemetry|uplink|protocol|decrypt|sector|nodes?|matrix|console|neural|quantum|synthesi\w*|intelligence station|arena console|sync failure|re-establish)\b/i

// Belt and braces with `animations: 'disabled'`: nothing moves, nothing fades.
const FREEZE_CSS = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
  }
  /* The page grain is SVG noise: incompressible (it tripled the PNG sizes) and it would
     only ever diff as noise. It is hidden for the shots; everything above it is real. */
  [data-testid='page-grain'] { visibility: hidden !important; }
`

// The app shell is a fixed, viewport-sized box with its own scroller, so the document
// never grows and a fullPage shot would stop at the fold. For the screenshot only, the
// shell is let out to its natural height so the whole page is captured.
async function unpinShell(page) {
  await page.addStyleTag({
    content: 'html, body, #react-root { height: auto !important; overflow: visible !important; }',
  })
  await page.evaluate(() => {
    const scroller = document.getElementById('main-content').parentElement
    const shell = scroller.parentElement
    Object.assign(shell.style, { position: 'relative', bottom: 'auto', minHeight: '100vh', overflow: 'visible' })
    Object.assign(scroller.style, { flex: 'none', minHeight: '100vh', overflowY: 'visible' })
    // The mobile tab bar is fixed to the viewport; in a page-tall shot that would strand it
    // mid-page, so it is pinned to the bottom of the page (its scrolled-to-the-end spot).
    for (const el of document.querySelectorAll('nav.fixed.bottom-0')) {
      Object.assign(el.style, { position: 'absolute' })
    }
  })
}

for (const width of [390, 1280]) {
  for (const { path, name, cards, frames, legalText, clipHeight } of PAGES) {
    test(`${path} @${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      const { unmocked } = await mockApi(page)

      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('#main-content')).toBeVisible()
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
      expect(unmocked, 'requests with no captured fixture').toEqual([])
      await page.addStyleTag({ content: FREEZE_CSS })
      await page.evaluate(() => document.fonts.ready)

      // Nothing overflows sideways: the document, and the app's own scroller (which clips
      // with overflow-x: hidden, so the document check alone could never fail).
      const overflow = await page.evaluate(() => {
        const scroller = document.getElementById('main-content').parentElement
        return {
          doc: document.documentElement.scrollWidth,
          scroller: scroller.scrollWidth,
          scrollerClient: scroller.clientWidth,
          inner: window.innerWidth,
        }
      })
      expect(overflow.doc, 'document scrollWidth').toBeLessThanOrEqual(overflow.inner)
      expect(overflow.scroller, 'app scroller scrollWidth').toBeLessThanOrEqual(overflow.scrollerClient)

      // Uniformity: every non-live card has identical chrome.
      const chromeOf = (selector) =>
        page.$$eval(selector, (els) =>
          els.map((e) => {
            const s = getComputedStyle(e)
            return [s.backgroundColor, s.borderTopColor, s.borderTopWidth, s.borderTopLeftRadius].join('|')
          }),
        )
      const chrome = await chromeOf('.bg-surface-1.rounded-lg:not(.card-live)')
      if (cards) expect(chrome.length, 'cards on the page').toBeGreaterThan(0)
      expect([...new Set(chrome)], 'distinct card chrome').toHaveLength(Math.min(chrome.length, 1))
      if (frames) {
        const frameChrome = await chromeOf(frames)
        expect(frameChrome.length, 'table frames on the page').toBeGreaterThan(0)
        expect([...new Set(frameChrome)], 'distinct table-frame chrome').toHaveLength(1)
      }

      // No banned words in the rendered text.
      if (!legalText) {
        const text = await page.evaluate(() => document.body.innerText)
        expect(text).not.toMatch(BANNED)
      }

      // Accessibility: zero color-contrast violations. Other serious/critical findings are
      // reported (once per page, at 1280) but do not fail the run.
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(axe.violations.filter((v) => v.id === 'color-contrast')).toEqual([])
      if (width === 1280) {
        const other = axe.violations.filter(
          (v) => v.id !== 'color-contrast' && (v.impact === 'serious' || v.impact === 'critical'),
        )
        const summary = other.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}`).join(', ')
        console.log(`[axe] ${path}: ${summary || 'none'}`)
      }

      await unpinShell(page)
      await expect(page).toHaveScreenshot(`${name}-${width}.png`, {
        fullPage: true,
        ...(clipHeight && { clip: { x: 0, y: 0, width, height: clipHeight } }),
        timeout: 20_000,
      })

      expect(unmocked, 'requests with no captured fixture').toEqual([])
    })
  }
}
