import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const BASE_THEME = {
  playGlassClick: vi.fn(),
  playThud: vi.fn(),
  isTransitioning: false,
  transitionImage: null,
  soundEnabled: true,
  toggleSound: vi.fn(),
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
  timezone: 'local',
  updateTimezone: vi.fn(),
}

const mockUseTheme = vi.fn(() => BASE_THEME)
vi.mock('@/context/ThemeContext', () => ({ useTheme: () => mockUseTheme() }))

// ScoreTicker and CommandBar fetch live data (useScoreboard / fetchPlayers) — stubbed here
// so this test stays isolated and deterministic; they're separate rollout tasks' files.
vi.mock('@/components/sport/ScoreTicker', () => ({ ScoreTicker: () => <div data-testid="score-ticker-stub" /> }))
vi.mock('@/components/ui/CommandBar', () => ({ CommandBar: () => <div data-testid="command-bar-stub" /> }))

import AppLayout from './AppLayout'

// Banned copy list from rollout-rules.md / global-constraints.md (case-insensitive; "node"/"nodes"
// checked separately since it's only banned in its capitalized copy forms, matching check-design.mjs).
const BANNED = /\b(telemetry|uplink|protocol\w*|sector|decrypt\w*|matrix|console|neural|quantum|synthesi\w*|intelligence station|arena console|sync failure|re-establish)\b/i
const BANNED_NODE = /\b(Node|Nodes|NODE|NODES)\b/

const EXPECTED_LINKS = ['Home', 'Scoreboard', 'Standings', 'Picks', 'Stats', 'Teams', 'Players']

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
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

  it('renders no banned copy with the menu and settings drawer open', async () => {
    const user = userEvent.setup()
    renderLayout()

    await user.click(screen.getByRole('button', { name: 'Toggle navigation menu' }))
    expect(BANNED.test(document.body.textContent)).toBe(false)
    expect(BANNED_NODE.test(document.body.textContent)).toBe(false)
    // the plain-copy mobile menu carries the same 7 links, in the same terms
    const menuHeading = screen.getByRole('heading', { name: 'Menu' })
    const menuNav = menuHeading.closest('div').parentElement.querySelector('nav')
    expect(within(menuNav).getAllByRole('link').map((el) => el.textContent)).toEqual(EXPECTED_LINKS)
    await user.click(screen.getByRole('button', { name: 'Toggle navigation menu' }))

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(BANNED.test(document.body.textContent)).toBe(false)
    expect(BANNED_NODE.test(document.body.textContent)).toBe(false)
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
    // required copy-table renames, still present with their new plain wording
    expect(screen.getByText('Favorite team')).toBeInTheDocument()
    expect(screen.getByText('Data')).toBeInTheDocument()
    expect(screen.getByText('Background texture')).toBeInTheDocument()
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0)
    // removed/renamed old copy must not be present
    expect(screen.queryByText('Node Affinity')).toBeNull()
    expect(screen.queryByText('Data Uplink')).toBeNull()
    expect(screen.queryByText('System Protocols')).toBeNull()
    expect(screen.queryByText('Intelligence Station')).toBeNull()
    expect(screen.queryByText('Background glow')).toBeNull()
  })

  it('wordmark is a plain t-section span, not the tracked/italic wordmark', () => {
    renderLayout()
    const wordmark = screen.getByText('Lunara Sports')
    expect(wordmark).toHaveClass('t-section')
    expect(wordmark.className).not.toMatch(/italic/)
    expect(wordmark.className).not.toMatch(/tracking-/)
  })

  it('has a bottom tab bar rendered as a distinct, labeled navigation landmark', () => {
    // BottomNav (frontend/src/components/sport/BottomNav.jsx) is a separate file, so it isn't
    // asserted in detail here. The brief's exact wording (aria-label="Primary") is asserted on
    // this task's own top-bar nav above; this only guards that BottomNav still renders as an
    // accessibly-labeled nav landmark distinct from the top bar's "Primary" nav.
    renderLayout()
    const navs = screen.getAllByRole('navigation')
    expect(navs.length).toBeGreaterThanOrEqual(2)
    const bottomBar = navs.find((el) => el.getAttribute('aria-label') !== 'Primary')
    expect(bottomBar).toBeTruthy()
    expect(bottomBar.getAttribute('aria-label')).toBeTruthy()
  })

  it('the settings drawer and the mobile menu are distinctly named landmarks (D16 a11y)', async () => {
    const user = userEvent.setup()
    renderLayout()
    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    const dialog = screen.getByRole('dialog', { name: 'Settings' })
    expect(dialog).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull()
    // ruling D17 (label-in-name): the drawer's visible heading matches its accessible
    // name — "Settings" — rather than the mobile nav overlay's "Menu".
    expect(within(dialog).getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(within(dialog).queryByText('Menu')).toBeNull()
  })

  it('the settings-gear icon keeps its hover rotate motion', () => {
    renderLayout()
    const gearButton = screen.getByRole('button', { name: 'Open settings' })
    expect(gearButton).toHaveClass('group/settings')
    const icon = gearButton.querySelector('svg')
    expect(icon).toHaveClass('group-hover/settings:rotate-180', 'duration-[1.5s]')
  })

  it('"Background texture" drives the page grain layer opacity (ruling D15)', () => {
    mockUseTheme.mockReturnValue({ ...BASE_THEME, arenaIntensity: 0 })
    const { rerender, container } = render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>
    )
    const grainAt0 = screen.getByTestId('page-grain').style.opacity

    mockUseTheme.mockReturnValue({ ...BASE_THEME, arenaIntensity: 1 })
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>
    )
    const grainAt1 = screen.getByTestId('page-grain').style.opacity

    expect(Number(grainAt0)).toBe(0)
    expect(Number(grainAt1)).toBeGreaterThan(Number(grainAt0))
    // it's a real ceiling, not "always visible" — well under fully opaque
    expect(Number(grainAt1)).toBeLessThanOrEqual(0.12)
    expect(container).toBeTruthy()
  })
})
