import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import GameDetailPage from './GameDetailPage'
import * as api from '@/services/api'

// The mocked hook must return stable function references across re-renders —
// GameDetailPage's data-loading effect depends on `setArenaTheme`, so a fresh
// vi.fn() on every call would re-trigger the effect forever and the page
// would never leave its loading state.
vi.mock('@/context/ThemeContext', () => {
  const playGlassClick = vi.fn()
  const playThud = vi.fn()
  const setArenaTheme = vi.fn()
  return {
    useTheme: () => ({
      playGlassClick,
      playThud,
      setArenaTheme,
      refreshInterval: 10,
      timezone: 'local',
    }),
  }
})

const MOCK_PLAYS = []
const MOCK_BOX_DATA = {
  home: {
    players: [
      { name: 'Nikola Jokic', points: 24, rebounds: 10, assists: 8, fouls: 2, fg: '9-14', starter: true },
    ],
  },
  away: {
    players: [
      { name: 'LeBron James', points: 20, rebounds: 6, assists: 5, fouls: 1, fg: '8-16', starter: true },
    ],
  },
}

vi.mock('@/hooks/useGameFeed', () => ({
  useGameFeed: () => ({
    plays: MOCK_PLAYS,
    connected: true,
    error: null,
    gameUpdate: null,
    pickUpdates: null,
    boxData: MOCK_BOX_DATA,
  }),
}))

vi.mock('@/services/api', () => ({
  fetchGame: vi.fn(),
  fetchStandings: vi.fn(),
  buildStandingsLookup: () => ({}),
  fetchModelPicks: vi.fn(),
  fetchBoxScore: vi.fn(),
  fetchPlays: vi.fn(),
  addReaction: vi.fn(),
}))

const MOCK_GAME = {
  id: '401902644',
  home_team: 'DEN',
  away_team: 'LAL',
  home_team_full: 'Denver Nuggets',
  away_team_full: 'Los Angeles Lakers',
  home_score: 58,
  away_score: 52,
  status: 'live',
  quarter: 3,
  clock: '7:41',
  venue: 'Ball Arena',
  start_time: '2026-09-25T19:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/game/401902644']}>
      <Routes>
        <Route path="/game/:id" element={<GameDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('GameDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.fetchGame.mockResolvedValue(MOCK_GAME)
    api.fetchStandings.mockResolvedValue([])
    api.fetchModelPicks.mockResolvedValue([])
    api.fetchBoxScore.mockResolvedValue(MOCK_BOX_DATA)
    api.fetchPlays.mockResolvedValue([])
  })

  it('shows both TeamMarks and t-score scores in the header for a live game', async () => {
    renderPage()
    const header = within(await screen.findByTestId('scoreboard-header'))
    expect(header.getByText('DEN')).toBeInTheDocument()
    expect(header.getByText('LAL')).toBeInTheDocument()
    expect(header.getByAltText('DEN logo')).toBeInTheDocument()
    expect(header.getByAltText('LAL logo')).toBeInTheDocument()
    expect(header.getByText('58')).toHaveClass('t-score')
    expect(header.getByText('52')).toHaveClass('t-score')
  })

  it('shows a live badge for the current quarter', async () => {
    renderPage()
    const header = within(await screen.findByTestId('scoreboard-header'))
    const badge = header.getByText('Quarter 3')
    expect(badge).toHaveClass('text-live')
    expect(badge.querySelector('[aria-hidden]')).toBeInTheDocument()
  })

  it('renders the box score as a table with tabular numbers', async () => {
    renderPage()
    const tables = await screen.findAllByRole('table')
    expect(tables.length).toBeGreaterThan(0)

    let numericCell = null
    for (const table of tables) {
      const matches = within(table).queryAllByText('24')
      if (matches.length) {
        numericCell = matches[0]
        break
      }
    }
    expect(numericCell).toHaveClass('tnum')
  })

  it('has no banned copy anywhere on the page', async () => {
    renderPage()
    await screen.findByTestId('scoreboard-header')
    const banned = /telemetry|uplink|protocol|decrypt|sector|\bnode\b|\bnodes\b|matrix|neural|quantum|synthesi|intelligence station|arena console|sync failure|re-establish/i
    expect(document.body.textContent).not.toMatch(banned)
  })

  it('shows PageState when fetchGame fails', async () => {
    api.fetchGame.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText("Couldn't load this game.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
