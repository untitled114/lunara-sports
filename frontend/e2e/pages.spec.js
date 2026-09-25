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
`

// Screenshot only, after every assertion has run against the real page (grain included):
// the page grain is SVG noise, incompressible (it tripled the PNG sizes) and it would only
// ever diff as noise, so it is hidden for the shots. Everything above it is real.
const HIDE_GRAIN_CSS = `[data-testid='page-grain'] { visibility: hidden !important; }`

// The arena backdrop (ruling D31) is fixed to the viewport in the app. Once the shell is let
// out to page height for a full-page shot, it would stretch the photo over the whole page
// (a 2,500px-tall leather texture, 1.5-2.3 MB PNGs). For the shot it keeps its real,
// viewport-sized box at the top of the page; below that the page shows the backdrop color.
// The photo and glow stay visible and are compared.
const PIN_BACKDROP_CSS = `[data-testid='arena-backdrop'] { bottom: auto !important; height: 900px !important; }`

// The app shell is a fixed, viewport-sized box with its own scroller, so the document
// never grows and a fullPage shot would stop at the fold. For the screenshot only, the
// shell is let out to its natural height so the whole page is captured. The grain is
// hidden here too, so it only ever leaves the screenshots, never the assertions.
async function unpinShell(page) {
  await page.addStyleTag({ content: HIDE_GRAIN_CSS })
  await page.addStyleTag({ content: PIN_BACKDROP_CSS })
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

      // Uniformity: every non-live card has identical chrome. Cards are the translucent
      // bg-surface-card over the arena backdrop (ruling D31); an opaque bg-surface-1 box with
      // card radius is matched too, so a card that missed the switch fails here.
      const chromeOf = (selector) =>
        page.$$eval(selector, (els) =>
          els.map((e) => {
            const s = getComputedStyle(e)
            return [s.backgroundColor, s.borderTopColor, s.borderTopWidth, s.borderTopLeftRadius].join('|')
          }),
        )
      const chrome = await chromeOf(
        ':is(.bg-surface-card, .bg-surface-1).rounded-lg:not(.card-live)',
      )
      if (cards) expect(chrome.length, 'cards on the page').toBeGreaterThan(0)
      expect([...new Set(chrome)], 'distinct card chrome').toHaveLength(Math.min(chrome.length, 1))
      if (frames) {
        const frameChrome = await chromeOf(frames)
        expect(frameChrome.length, 'table frames on the page').toBeGreaterThan(0)
        expect([...new Set(frameChrome)], 'distinct table-frame chrome').toHaveLength(1)
      }

      // No text dimmer than --text-3: every visible neutral (gray) text color is at least
      // as light as the token, fully opaque. Colored text (accent, live, loss, warn) is
      // covered by axe's contrast check below.
      const dimText = await page.evaluate(() => {
        const toRgba = (c) => {
          const m = c.match(/rgba?\(([^)]+)\)/)
          if (!m) return null
          const [r, g, b, a = '1'] = m[1].split(/[\s,/]+/).filter(Boolean)
          return [Number(r), Number(g), Number(b), Number(a)]
        }
        const lum = ([r, g, b]) => {
          const f = (v) => {
            const x = v / 255
            return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
          }
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
        }
        const probe = document.createElement('span')
        probe.style.color = 'var(--text-3)'
        document.body.appendChild(probe)
        const floor = lum(toRgba(getComputedStyle(probe).color))
        probe.remove()
        const bad = []
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.textContent.trim()) continue
          const el = n.parentElement
          if (!el || !el.getClientRects().length) continue
          const s = getComputedStyle(el)
          if (s.visibility === 'hidden') continue
          const c = toRgba(s.color)
          if (!c) continue
          const neutral = Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) <= 24
          if (neutral && (c[3] < 1 || lum(c) < floor - 1e-6)) bad.push(`${n.textContent.trim().slice(0, 40)} (${s.color})`)
        }
        return bad
      })
      expect(dimText, 'text dimmer than --text-3').toEqual([])

      // Tabular numbers on every score and every numeric table cell.
      const proportional = await page.$$eval('.t-score, .t-score-display, td.text-right', (els) =>
        els
          .filter((e) => e.textContent.trim() && !getComputedStyle(e).fontVariantNumeric.includes('tabular-nums'))
          .map((e) => e.textContent.trim().slice(0, 20)),
      )
      expect(proportional, 'scores and stat cells without tabular-nums').toEqual([])

      // No banned words in the rendered text.
      if (!legalText) {
        const text = await page.evaluate(() => document.body.innerText)
        expect(text).not.toMatch(BANNED)
      }

      // Accessibility: zero color-contrast violations and zero other serious or critical
      // findings, at both widths.
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(axe.violations.filter((v) => v.id === 'color-contrast')).toEqual([])
      const serious = axe.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join('; ')}`)
      expect(serious, 'serious or critical axe findings').toEqual([])

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
