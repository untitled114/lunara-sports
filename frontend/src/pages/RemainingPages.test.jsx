import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import picksToday from '@/test/fixtures/picksToday.json'
import statsLeaders from '@/test/fixtures/statsLeaders.json'
import statsTeams from '@/test/fixtures/statsTeams.json'
import gamesOct03 from '@/test/fixtures/gamesOct03.json'

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

// picksToday.json is the real (unmodified) GET /picks/today response, captured
// while this task was in flight — see the fixture's _source. It's empty: no
// props are populated in production right now (preseason). There is no real
// populated-picks response available anywhere on the read-only API (checked
// /picks/today, several real completed game IDs via /games/{id}/picks — every
// one is []), so there is no "renders a populated pick card" test here; a
// fabricated one would be exactly the invented fixture this rule prohibits.
describe('PicksPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('renders the real (empty) picks response as a plain empty state with no banned words', async () => {
    api.fetchTodayPicks.mockResolvedValue(picksToday.data)
    wrap(<PicksPage />)
    expect(await screen.findByText('No picks match these filters.')).toBeInTheDocument()
    assertNoBannedWords(document.body.textContent)
  })

  it('error path shows PageState with Try again and retries', async () => {
    api.fetchTodayPicks.mockRejectedValueOnce(new Error('down')).mockResolvedValue(picksToday.data)
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

  it('renders the schedule table with real game data and no banned words', async () => {
    // Real scheduled game from GET /games/?game_date=2026-10-03 (see fixture _source).
    api.fetchGames.mockResolvedValue(gamesOct03.data)
    wrap(<SchedulePage />)
    await waitFor(() => expect(screen.getAllByRole('columnheader', { name: 'Matchup' }).length).toBeGreaterThan(0))
    const [game] = gamesOct03.data
    expect(screen.getAllByText(game.away_team, { exact: false }).length).toBeGreaterThan(0)
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

  it('renders real league leaders with no banned words', async () => {
    // Real GET /stats/leaders?limit=10 response (see fixture _source).
    api.fetchStatLeaders.mockResolvedValue(statsLeaders.data)
    api.fetchTeamStatsList.mockResolvedValue(statsTeams.data)
    wrap(<StatsPage />)
    const [topScorer] = statsLeaders.data.categories.pts
    await waitFor(() => expect(screen.getByText(topScorer.player)).toBeInTheDocument())
    expect(screen.getAllByText(topScorer.team).length).toBeGreaterThan(0)
    expect(screen.getByText('League stats', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Offense' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Defense' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Advanced stats' })).toBeInTheDocument()
    assertNoBannedWords(document.body.textContent)
  })

  it('shows a plain empty state for team stats not yet available (real, unpopulated response)', async () => {
    api.fetchStatLeaders.mockResolvedValue(statsLeaders.data)
    api.fetchTeamStatsList.mockResolvedValue(statsTeams.data)
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
    api.fetchStatLeaders.mockResolvedValue(statsLeaders.data)
    api.fetchTeamStatsList.mockResolvedValue(statsTeams.data)
    const retry = screen.getByRole('button', { name: 'Try again' })
    await userEvent.click(retry)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Statistics' })).toBeInTheDocument())
  })
})
