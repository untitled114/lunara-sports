import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// The same non-visual checks as e2e/pages.spec.js, run against the live site and live API.
const PAGES = [
  { path: '/' },
  { path: '/scoreboard', cards: true },
  { path: '/game/401902644' },
  { path: '/standings' },
  { path: '/teams', cards: true },
  { path: '/team/MIA' },
  { path: '/schedule' },
  { path: '/players' },
  { path: '/player/4066261' },
  { path: '/stats', cards: true },
  { path: '/picks' },
  { path: '/terms' },
  { path: '/privacy', legalText: true },
]

const BANNED = /\b(telemetry|uplink|protocol|decrypt|sector|nodes?|matrix|console|neural|quantum|synthesi\w*|intelligence station|arena console|sync failure|re-establish)\b/i

for (const width of [390, 1280]) {
  for (const { path, cards, legalText } of PAGES) {
    test(`${path} @${width}`, async ({ page }) => {
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path)
      await expect(page.locator('#main-content')).toBeVisible()
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 })
      // The game page polls, so it may never go idle; ten seconds is enough for first data.
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
      // Let entrance fades finish (a half-faded heading is a false contrast failure); endless
      // ones such as the live ping are left running.
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
            .map((a) => a.finished.catch(() => {})),
        ),
      )

      const overflow = await page.evaluate(() => {
        const scroller = document.getElementById('main-content').parentElement
        return {
          doc: document.documentElement.scrollWidth,
          inner: window.innerWidth,
          scroller: scroller.scrollWidth,
          scrollerClient: scroller.clientWidth,
        }
      })
      expect(overflow.doc, 'document scrollWidth').toBeLessThanOrEqual(overflow.inner)
      expect(overflow.scroller, 'app scroller scrollWidth').toBeLessThanOrEqual(overflow.scrollerClient)

      const chrome = await page.$$eval('.bg-surface-1.rounded-lg:not(.card-live)', (els) =>
        els.map((e) => {
          const s = getComputedStyle(e)
          return [s.backgroundColor, s.borderTopColor, s.borderTopWidth, s.borderTopLeftRadius].join('|')
        }),
      )
      if (cards) expect(chrome.length, 'cards on the page').toBeGreaterThan(0)
      expect([...new Set(chrome)], 'distinct card chrome').toHaveLength(Math.min(chrome.length, 1))

      if (!legalText) expect(await page.evaluate(() => document.body.innerText)).not.toMatch(BANNED)

      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(axe.violations.filter((v) => v.id === 'color-contrast')).toEqual([])
      expect(errors, 'uncaught page errors').toEqual([])
    })
  }
}
