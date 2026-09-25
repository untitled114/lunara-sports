import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    playGlassClick: vi.fn(),
    playThud: vi.fn(),
    triggerArenaEntry: (cb) => cb && cb(),
    timezone: 'local',
  }),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null, token: null }),
}))

const api = vi.hoisted(() => ({
  fetchTodayPicks: vi.fn(),
  fetchGames: vi.fn(),
  fetchStatLeaders: vi.fn(),
  fetchTeamStatsList: vi.fn(),
  fetchPlayers: vi.fn(),
}))
vi.mock('@/services/api', () => api)

import PrivacyPage from './PrivacyPage'
import TermsPage from './TermsPage'
import AdminPage from './AdminPage'
import LandingPage from './LandingPage'
import PicksPage from './PicksPage'
import SchedulePage from './SchedulePage'
import StatsPage from './StatsPage'

// The exact wording of check-design.mjs's BANNED regex (single words / phrases,
// case-insensitive), minus `node`/`nodes` which the checker treats specially
// (only capitalized copy forms are banned there) — rendered UI text never
// contains a lowercase JS identifier, so a plain case-insensitive check is fine.
const BANNED_WORDS = [
  'telemetry',
  'uplink',
  'protocol',
  'decrypt',
  'sector',
  'matrix',
  'console',
  'neural',
  'quantum',
  'synthesi',
  'intelligence station',
  'arena console',
  'sync failure',
  're-establish',
  'node',
]

function assertNoBannedWords(text, { allow = [] } = {}) {
  const lower = text.toLowerCase()
  for (const word of BANNED_WORDS) {
    if (allow.includes(word)) continue
    expect(lower).not.toContain(word)
  }
}

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PrivacyPage', () => {
  it('has no banned words except the one allowed legal sentence naming telemetry services', () => {
    wrap(<PrivacyPage />)
    assertNoBannedWords(document.body.textContent, { allow: ['telemetry'] })
    expect(screen.getByText(/does not currently use any analytics, tracking, or telemetry services/)).toBeInTheDocument()
  })
})

describe('TermsPage', () => {
  it('has no banned words', () => {
    wrap(<TermsPage />)
    assertNoBannedWords(document.body.textContent)
    expect(screen.getByRole('heading', { name: 'Terms & Conditions' })).toBeInTheDocument()
  })
})

describe('AdminPage', () => {
  it('shows a sign-in prompt with no banned words when logged out', () => {
    wrap(<AdminPage />)
    assertNoBannedWords(document.body.textContent)
    expect(screen.getByText('Sign in to access the admin dashboard.')).toBeInTheDocument()
  })
})

describe('LandingPage', () => {
  it('renders the hero and league cards with no banned words', () => {
    wrap(<LandingPage />)
    assertNoBannedWords(document.body.textContent)
    expect(screen.getByRole('heading', { name: 'Lunara Sports' })).toBeInTheDocument()
    expect(screen.getByText('Live now')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'NBA' })).toBeInTheDocument()
  })
})

describe('PicksPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('renders picks with no banned words', async () => {
    api.fetchTodayPicks.mockResolvedValue([
      {
        id: 1,
        player_name: 'Test Player',
        market: 'POINTS',
        prediction: 'OVER',
        line: 24.5,
        tier: 'X',
        model_version: 'v5',
        book: 'draftkings',
        edge: 4.2,
        edge_pct: 18,
        p_over: 0.61,
        actual_value: null,
        is_hit: null,
      },
    ])
    wrap(<PicksPage />)
    await waitFor(() => expect(screen.getByText('Test Player')).toBeInTheDocument())
    assertNoBannedWords(document.body.textContent)
  })

  it('shows a plain empty state when there are no picks', async () => {
    api.fetchTodayPicks.mockResolvedValue([])
    wrap(<PicksPage />)
    expect(await screen.findByText('No picks match these filters.')).toBeInTheDocument()
  })

  it('error path shows PageState with Try again and retries', async () => {
    api.fetchTodayPicks.mockRejectedValueOnce(new Error('down')).mockResolvedValue([])
    wrap(<PicksPage />)
    expect(await screen.findByText("Couldn't load picks.")).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Try again' })
    await userEvent.click(retry)
    await waitFor(() => expect(api.fetchTodayPicks).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('No picks match these filters.')).toBeInTheDocument()
  })
})

describe('SchedulePage', () => {
  afterEach(() => vi.clearAllMocks())

  it('renders the schedule table with no banned words', async () => {
    api.fetchGames.mockResolvedValue([
      {
        id: 'g1',
        away_team: 'MIA',
        home_team: 'TOR',
        away_score: 0,
        home_score: 0,
        status: 'scheduled',
        start_time: '2026-10-03T23:00:00Z',
      },
    ])
    wrap(<SchedulePage />)
    await waitFor(() => expect(screen.getAllByRole('columnheader', { name: 'Matchup' }).length).toBeGreaterThan(0))
    assertNoBannedWords(document.body.textContent)
  })

  it('empty range shows a plain empty state', async () => {
    api.fetchGames.mockResolvedValue([])
    wrap(<SchedulePage />)
    expect(await screen.findByText('No games found for this date range.')).toBeInTheDocument()
  })

  it('error path shows PageState with Try again and retries', async () => {
    api.fetchGames.mockRejectedValue(new Error('down'))
    wrap(<SchedulePage />)
    expect(await screen.findByText("Couldn't load the schedule.")).toBeInTheDocument()
    api.fetchGames.mockResolvedValue([])
    const retry = screen.getByRole('button', { name: 'Try again' })
    await userEvent.click(retry)
    await waitFor(() => expect(screen.queryByText("Couldn't load the schedule.")).not.toBeInTheDocument())
  })
})

describe('StatsPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('renders league stats with no banned words', async () => {
    api.fetchStatLeaders.mockResolvedValue({
      categories: {
        pts: [{ player_id: 1, player: 'Test Player', team: 'MIA', value: 30.1, rank: 1 }],
        ast: [],
        threes: [],
        reb: [],
        blk: [],
        stl: [],
      },
    })
    api.fetchTeamStatsList.mockResolvedValue([])
    wrap(<StatsPage />)
    await waitFor(() => expect(screen.getByText('Test Player')).toBeInTheDocument())
    expect(screen.getByText('League stats', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Offense' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Defense' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Advanced stats' })).toBeInTheDocument()
    assertNoBannedWords(document.body.textContent)
  })

  it('shows a plain empty state for team stats not yet available', async () => {
    api.fetchStatLeaders.mockResolvedValue({ categories: {} })
    api.fetchTeamStatsList.mockResolvedValue([])
    wrap(<StatsPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Statistics' })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('tab', { name: 'Franchise' }))
    expect(await screen.findByText("Team stats aren't available yet.")).toBeInTheDocument()
  })

  it('error path shows PageState with Try again and retries', async () => {
    api.fetchStatLeaders.mockRejectedValueOnce(new Error('down'))
    api.fetchTeamStatsList.mockRejectedValueOnce(new Error('down'))
    wrap(<StatsPage />)
    expect(await screen.findByText("Couldn't load stats.")).toBeInTheDocument()
    api.fetchStatLeaders.mockResolvedValue({ categories: {} })
    api.fetchTeamStatsList.mockResolvedValue([])
    const retry = screen.getByRole('button', { name: 'Try again' })
    await userEvent.click(retry)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Statistics' })).toBeInTheDocument())
  })
})
