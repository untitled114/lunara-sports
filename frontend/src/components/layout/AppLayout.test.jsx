import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const BASE_THEME = {
  arenaIntensity: 0.4,
  updateIntensity: vi.fn(),
  favoriteTeam: null,
  selectFavoriteTeam: vi.fn(),
  fontSize: 'md',
  updateFontSize: vi.fn(),
  reducedMotion: false,
  toggleReducedMotion: vi.fn(),
  refreshInterval: 30,
  updateRefreshInterval: vi.fn(),
  timezone: 'ET',
  updateTimezone: vi.fn(),
}

const mockUseTheme = vi.fn(() => BASE_THEME)
vi.mock('@/context/ThemeContext', () => ({ useTheme: () => mockUseTheme() }))

// ScoreTicker and CommandBar fetch live data (useScoreboard / fetchPlayers) - stubbed here
// so this test stays isolated and deterministic; they're separate rollout tasks' files.
vi.mock('@/components/sport/ScoreTicker', () => ({ ScoreTicker: () => <div data-testid="score-ticker-stub" /> }))
vi.mock('@/components/ui/CommandBar', () => ({
  CommandBar: ({ open }) => <div data-testid="command-bar-stub" data-open={String(Boolean(open))} />,
}))
// The menu panel's team list reads the standings; a real capture (e2e/fixtures/README.md).
import REAL_STANDINGS from '../../../e2e/fixtures/api/standings.json'
vi.mock('@/services/api', async () => {
  const actual = await vi.importActual('@/services/api')
  return { ...actual, fetchStandings: vi.fn(() => Promise.resolve(REAL_STANDINGS)) }
})

import AppLayout from './AppLayout'

// Banned copy list from rollout-rules.md / global-constraints.md (case-insensitive; "node"/"nodes"
// checked separately since it's only banned in its capitalized copy forms, matching check-design.mjs).
const BANNED = /\b(telemetry|uplink|protocol\w*|sector|decrypt\w*|matrix|console|neural|quantum|synthesi\w*|intelligence station|arena console|sync failure|re-establish)\b/i
const BANNED_NODE = /\b(Node|Nodes|NODE|NODES)\b/

const EXPECTED_LINKS = ['Home', 'Scoreboard', 'Standings', 'Stats', 'Teams', 'Players']

function renderLayout(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppLayout />
    </MemoryRouter>
  )
}

describe('AppLayout', () => {
  beforeEach(() => {
    mockUseTheme.mockReturnValue(BASE_THEME)
  })

  it('primary nav has plain, exact link names in order', () => {
    renderLayout()
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    const names = within(nav).getAllByRole('link').map((el) => el.textContent)
    expect(names).toEqual(EXPECTED_LINKS)
  })

  it('renders no banned copy at rest', () => {
    renderLayout()
    const text = document.body.textContent
    expect(BANNED.test(text)).toBe(false)
    expect(BANNED_NODE.test(text)).toBe(false)
  })

  it('renders no banned copy with the menu panel open, Settings included', async () => {
    const user = userEvent.setup()
    renderLayout()
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    const panel = screen.getByRole('dialog', { name: 'Menu' })
    expect(BANNED.test(document.body.textContent)).toBe(false)
    expect(BANNED_NODE.test(document.body.textContent)).toBe(false)
    const settings = within(panel).getByRole('region', { name: 'Settings' })
    for (const label of ['Favorite team', 'Background glow', 'Time zone']) {
      expect(within(settings).getByText(label)).toBeInTheDocument()
    }
  })

  it('the menu button opens the panel; Escape closes it and focus goes back to the button', async () => {
    const user = userEvent.setup()
    renderLayout()
    const button = screen.getByRole('button', { name: 'Open menu' })
    await user.click(button)
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull()
    expect(button).toHaveFocus()
  })

  it('the page behind the open menu panel does not scroll, and scrolls again once it closes', async () => {
    const user = userEvent.setup()
    renderLayout()
    const scroller = screen.getByTestId('page-scroller')
    expect(scroller.style.overflowY).toBe('auto')
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(scroller.style.overflowY).toBe('hidden')
    await user.keyboard('{Escape}')
    expect(scroller.style.overflowY).toBe('auto')
  })

  it('"/" opens search, but not while typing in a field; Ctrl+K opens it too', async () => {
    const user = userEvent.setup()
    renderLayout()
    const bar = screen.getByTestId('command-bar-stub')
    expect(bar).toHaveAttribute('data-open', 'false')
    const field = document.createElement('input')
    document.body.appendChild(field)
    field.focus()
    await user.keyboard('/')
    expect(bar).toHaveAttribute('data-open', 'false')
    field.remove()
    document.body.focus()
    await user.keyboard('/')
    expect(screen.getByTestId('command-bar-stub')).toHaveAttribute('data-open', 'true')
  })

  it('with the menu panel open, "/" and Ctrl+K do not open search behind it', async () => {
    const user = userEvent.setup()
    renderLayout()
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.keyboard('/')
    expect(screen.getByTestId('command-bar-stub')).toHaveAttribute('data-open', 'false')
    await user.keyboard('{Control>}k{/Control}')
    expect(screen.getByTestId('command-bar-stub')).toHaveAttribute('data-open', 'false')
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument()
  })

  it('Ctrl+K opens search', async () => {
    const user = userEvent.setup()
    renderLayout()
    await user.keyboard('{Control>}k{/Control}')
    expect(screen.getByTestId('command-bar-stub')).toHaveAttribute('data-open', 'true')
  })

  it('the top bar has a search field you can see', async () => {
    const user = userEvent.setup()
    renderLayout()
    await user.click(screen.getByRole('button', { name: 'Search players and teams' }))
    expect(screen.getByTestId('command-bar-stub')).toHaveAttribute('data-open', 'true')
  })

  it('page content sits in one centered column about 1,100px wide', () => {
    renderLayout('/standings')
    expect(document.getElementById('main-content').firstElementChild).toHaveClass('max-w-[1100px]', 'mx-auto')
  })

  it('wordmark is the one display-wordmark class, with no subtitle', () => {
    renderLayout()
    const wordmark = screen.getByText('Lunara Sports')
    expect(wordmark).toHaveClass('display-wordmark')
    // heavy/italic/tracking live in the tokens.css class, never as utilities here
    expect(wordmark.className).not.toMatch(/italic|font-black|font-extrabold|tracking-/)
    expect(screen.queryByText(/intelligence station/i)).toBeNull()
  })

  it('has a bottom tab bar rendered as a distinct, labeled navigation landmark', () => {
    // BottomNav (frontend/src/components/sport/BottomNav.jsx) is a separate file, so it isn't
    // asserted in detail here. The exact label (aria-label="Primary") is asserted on
    // the top-bar nav above; this only guards that BottomNav still renders as an
    // accessibly-labeled nav landmark distinct from the top bar's "Primary" nav.
    renderLayout()
    const navs = screen.getAllByRole('navigation')
    expect(navs.length).toBeGreaterThanOrEqual(2)
    const bottomBar = navs.find((el) => el.getAttribute('aria-label') !== 'Primary')
    expect(bottomBar).toBeTruthy()
    expect(bottomBar.getAttribute('aria-label')).toBeTruthy()
  })

  it('there is no settings gear in the top bar (Settings live in the menu panel)', () => {
    renderLayout()
    expect(screen.queryByRole('button', { name: 'Open settings' })).toBeNull()
  })

  it('"Background glow" drives the arena glow washes; the grain stays faint', () => {
    mockUseTheme.mockReturnValue({ ...BASE_THEME, arenaIntensity: 0 })
    const { rerender } = render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>
    )
    const glowAt0 = screen.getByTestId('arena-glow').style.opacity
    const grainAt0 = screen.getByTestId('page-grain').style.opacity

    mockUseTheme.mockReturnValue({ ...BASE_THEME, arenaIntensity: 1 })
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>
    )
    const glow = screen.getByTestId('arena-glow')

    expect(Number(glowAt0)).toBe(0)
    // capped (GLOW_SCALE) so the default setting keeps text on the backdrop at AA
    expect(Number(glow.style.opacity)).toBeCloseTo(0.7)
    // base's 1s fade, unchanged
    expect(glow.style.transition).toBe('opacity 1s')
    // the three washes: primary top-left, --glow-2 top-right, --glow-3 bottom-center
    expect(glow.style.backgroundImage).toContain('var(--glow-1)')
    expect(glow.style.backgroundImage).toContain('var(--glow-2)')
    expect(glow.style.backgroundImage).toContain('var(--glow-3)')
    // the grain no longer follows the slider, and stays well under opaque
    expect(screen.getByTestId('page-grain').style.opacity).toBe(grainAt0)
    expect(Number(grainAt0)).toBeGreaterThan(0)
    expect(Number(grainAt0)).toBeLessThanOrEqual(0.12)
  })

  it('the top-left glow follows the theme primary (favorite or home team)', () => {
    mockUseTheme.mockReturnValue({ ...BASE_THEME, accentColors: { primary: '#CE1141' } })
    renderLayout()
    const bg = screen.getByTestId('arena-glow').style.backgroundImage
    expect(bg).toMatch(/radial-gradient\(circle at 0% 0%, (#CE1141|rgb\(206, 17, 65\))/i)
  })

  it('the backdrop is the arena photo from public/branding, hidden from assistive tech', () => {
    renderLayout()
    const backdrop = screen.getByTestId('arena-backdrop')
    expect(backdrop).toHaveAttribute('aria-hidden', 'true')
    const img = backdrop.querySelector('img')
    expect(img).toHaveAttribute('src', '/branding/backdrop.webp')
    expect(img).toHaveAttribute('alt', '')
    expect(img).toHaveClass('opacity-40')
  })
})
