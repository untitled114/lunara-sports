import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { fetchStandings } from '@/services/api'
import { MenuPanel } from './MenuPanel'
// Real GET /standings capture (see e2e/fixtures/README.md).
import REAL_STANDINGS from '../../../e2e/fixtures/api/standings.json'

vi.mock('@/services/api', async () => {
  const actual = await vi.importActual('@/services/api')
  return { ...actual, fetchStandings: vi.fn() }
})

const PAGES = [
  ['Home', '/'],
  ['Scoreboard', '/scoreboard'],
  ['Schedule', '/schedule'],
  ['Standings', '/standings'],
  ['Stats', '/stats'],
  ['League leaders', '/stats/leaders/pts'],
  ['Players', '/players'],
  ['Teams', '/teams'],
]
const ALL = [...REAL_STANDINGS.eastern, ...REAL_STANDINGS.western]
const pct = (t) => Number(t.w) / Math.max(1, Number(t.w) + Number(t.l))

function renderPanel({ route = '/', onClose = vi.fn() } = {}) {
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[route]}>
        <MenuPanel open onClose={onClose} onOpenSearch={vi.fn()} />
      </MemoryRouter>
    </ThemeProvider>
  )
  return onClose
}

describe('MenuPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchStandings.mockResolvedValue(REAL_STANDINGS)
  })

  it('lists every page in its group, linked', () => {
    renderPanel()
    const nav = screen.getByRole('navigation', { name: 'Pages' })
    expect(within(nav).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual(PAGES)
  })

  it('every page link sits at the same indent in every group', () => {
    renderPanel()
    const nav = screen.getByRole('navigation', { name: 'Pages' })
    const indent = (a) => [...a.classList].filter((c) => /^(-?m[lrx]?|p[lrx]?)-/.test(c)).sort().join(' ')
    const indents = new Set(within(nav).getAllByRole('link').map(indent))
    expect(indents.size).toBe(1)
    const groups = within(nav).getAllByRole('link').map((a) => a.parentElement)
    expect(new Set(groups.map((g) => [...g.classList].filter((c) => /^-?m[lrx]?-|^p[lrx]?-/.test(c)).sort().join(' '))).size).toBe(1)
  })

  it('marks the page you are on', () => {
    renderPanel({ route: '/standings' })
    expect(screen.getByRole('link', { name: 'Standings' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('shows the five best records first, all 30 on request, and filters by search', async () => {
    const user = userEvent.setup()
    renderPanel()
    const teams = await screen.findByRole('list', { name: 'Teams' })
    const best = [...ALL].sort((a, b) => pct(b) - pct(a)).slice(0, 5).map((t) => t.name)
    expect(within(teams).getAllByRole('link').map((a) => a.textContent.replace(/\d+-\d+$/, ''))).toEqual(best)
    await user.click(screen.getByRole('button', { name: 'Show all 30' }))
    expect(within(teams).getAllByRole('link')).toHaveLength(30)
    await user.type(screen.getByRole('searchbox', { name: 'Search teams' }), 'mia')
    expect(within(teams).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/team/MIA'])
  })

  it('closes with Escape, the X, or a tap outside', async () => {
    const user = userEvent.setup()
    const onClose = renderPanel()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Close menu' }))
    await user.click(screen.getByTestId('menu-overlay'))
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('holds Settings: time zone in Eastern by default, no sound control', () => {
    renderPanel()
    const settings = screen.getByRole('region', { name: 'Settings' })
    const zone = within(settings).getByRole('tablist', { name: 'Time zone' })
    expect(within(zone).getByRole('tab', { name: 'ET' })).toHaveAttribute('aria-selected', 'true')
    for (const label of ['Text size', 'Background glow', 'Favorite team', 'Refresh interval']) {
      expect(within(settings).getByText(label)).toBeInTheDocument()
    }
    expect(within(settings).queryByText(/sound/i)).toBeNull()
  })

  it('every link, button and field in the panel is at least 44px tall on a phone', async () => {
    renderPanel()
    await screen.findByRole('list', { name: 'Teams' })
    const dialog = screen.getByRole('dialog', { name: 'Menu' })
    const TALL = /(^|\s)(min-h-\[44px\]|h-11|h-12|min-h-11)(\s|$)/
    const short = [...dialog.querySelectorAll('a, button, input')]
      .filter((el) => !TALL.test(el.getAttribute('class') || '') && el.getAttribute('type') !== 'range')
      .filter((el) => !el.closest('[role="tablist"]'))
      .map((el) => el.getAttribute('aria-label') || el.textContent.trim() || el.tagName)
    expect(short).toEqual([])
  })

  it('keeps keyboard focus inside the open panel (Tab and Shift+Tab wrap around)', async () => {
    const user = userEvent.setup()
    // The page behind the panel has its own controls, as the real page does.
    render(
      <ThemeProvider>
        <MemoryRouter>
          <button type="button">Behind, before</button>
          <MenuPanel open onClose={vi.fn()} onOpenSearch={vi.fn()} />
          <button type="button">Behind, after</button>
        </MemoryRouter>
      </ThemeProvider>
    )
    await screen.findByRole('list', { name: 'Teams' })
    const dialog = screen.getByRole('dialog', { name: 'Menu' })
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus()
    const stops = [...dialog.querySelectorAll('a[href], button, input, [tabindex="0"]')].filter((el) => !el.disabled)
    const first = stops[0]
    const last = stops[stops.length - 1]
    first.focus()
    await user.tab({ shift: true })
    expect(last).toHaveFocus()
    await user.tab()
    expect(first).toHaveFocus()
  })

  it('renders nothing while closed', () => {
    const { container } = render(
      <ThemeProvider>
        <MemoryRouter>
          <MenuPanel open={false} onClose={vi.fn()} onOpenSearch={vi.fn()} />
        </MemoryRouter>
      </ThemeProvider>
    )
    expect(container).toBeEmptyDOMElement()
  })
})
