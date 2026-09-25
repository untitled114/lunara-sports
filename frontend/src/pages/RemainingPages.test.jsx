import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import picksToday from '@/test/fixtures/picksToday.json'
import statsLeaders from '@/test/fixtures/statsLeaders.json'
import statsTeams from '@/test/fixtures/statsTeams.json'
import gamesOct03 from '@/test/fixtures/gamesOct03.json'
import gamesNext from '@/test/fixtures/gamesNext.json'
import { todayET, addDaysISO } from '@/lib/et'

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
  fetchNextGameDate: vi.fn(),
}))
vi.mock('@/services/api', () => api)

// The landing page's "Live now" badge reads the same scoreboard feed as the ticker.
const scoreboard = vi.hoisted(() => ({ useScoreboard: vi.fn() }))
vi.mock('@/hooks/useScoreboard', () => scoreboard)

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
  // Real GET /games/next?after=2026-09-25 response (see the fixture's _source).
  api.fetchNextGameDate.mockResolvedValue(gamesNext.data.date)
  scoreboard.useScoreboard.mockReturnValue({ games: [], connected: false, loading: false })
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
    expect(screen.getByRole('heading', { name: 'NBA' })).toBeInTheDocument()
  })

  it('shows no "Live now" badge when no game is live (the real Oct 3 slate is scheduled)', () => {
    scoreboard.useScoreboard.mockReturnValue({ games: gamesOct03.data, connected: true, loading: false })
    wrap(<LandingPage />)
    expect(screen.queryByText('Live now')).toBeNull()
    expect(scoreboard.useScoreboard).toHaveBeenCalledWith(todayET())
  })

  it('shows "Live now" with its ping only while a game is live or at halftime', () => {
    // Rendering-state override, as in GameDetailPage.test: the real Oct 3 game with only
    // its status changed (no game is live in the API right now).
    for (const status of ['live', 'halftime']) {
      scoreboard.useScoreboard.mockReturnValue({
        games: [{ ...gamesOct03.data[0], status }],
        connected: true,
        loading: false,
      })
      const { unmount } = wrap(<LandingPage />)
      const badge = screen.getByText('Live now')
      expect(badge.parentElement.querySelector('.animate-ping')).toBeInTheDocument()
      unmount()
    }
  })

  it('says "Coming soon" for MLB and NFL, not a past season date', () => {
    wrap(<LandingPage />)
    expect(screen.getAllByText(/Coming soon\./)).toHaveLength(2)
    expect(document.body.textContent).not.toMatch(/Coming (spring|fall)/)
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

  it('renders the real (empty) picks response as an empty state that names the next game day', async () => {
    api.fetchTodayPicks.mockResolvedValue(picksToday.data)
    wrap(<PicksPage />)
    expect(await screen.findByText('No picks yet.')).toBeInTheDocument()
    expect(screen.getByText('Picks appear here on game days.')).toBeInTheDocument()
    expect(screen.queryByText('No picks match these filters.')).toBeNull()
    const link = await screen.findByRole('link', { name: 'Next game: Sat, Oct 3 →' })
    expect(link).toHaveAttribute('href', '/scoreboard?date=2026-10-03')
    // On or after today: the lookup starts from yesterday (ET).
    expect(api.fetchNextGameDate).toHaveBeenCalledWith(addDaysISO(todayET(), -1))
    assertNoBannedWords(document.body.textContent)
  })

  it('keeps every Tier option in the filter row (the groups wrap instead of overflowing)', async () => {
    api.fetchTodayPicks.mockResolvedValue(picksToday.data)
    wrap(<PicksPage />)
    await screen.findByText('No picks yet.')
    for (const name of ['X', 'Z', 'META', 'Goldmine', 'Star']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument()
    }
    const row = screen.getByRole('tab', { name: 'Goldmine' }).closest('.flex-wrap')
    expect(row).not.toBeNull()
  })

  it('error path shows PageState with Try again and retries', async () => {
    api.fetchTodayPicks.mockRejectedValueOnce(new Error('down')).mockResolvedValue(picksToday.data)
    wrap(<PicksPage />)
    expect(await screen.findByText("Couldn't load picks.")).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Try again' })
    await userEvent.click(retry)
    await waitFor(() => expect(api.fetchTodayPicks).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('No picks yet.')).toBeInTheDocument()
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

  it('empty range names the range and links the next game day after it', async () => {
    api.fetchGames.mockResolvedValue([])
    wrap(<SchedulePage />)
    expect(await screen.findByText(/^No games from \w{3}, \w{3} \d{1,2} to \w{3}, \w{3} \d{1,2}\.$/)).toBeInTheDocument()
    const link = await screen.findByRole('link', { name: 'Next game: Sat, Oct 3 →' })
    expect(link).toHaveAttribute('href', '/scoreboard?date=2026-10-03')
    expect(api.fetchNextGameDate).toHaveBeenCalledWith(addDaysISO(todayET(), 3))
  })

  it('names the week buttons for assistive tech', async () => {
    api.fetchGames.mockResolvedValue([])
    wrap(<SchedulePage />)
    expect(screen.getByRole('button', { name: 'Previous week' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next week' })).toBeInTheDocument()
    await screen.findByText(/^No games from/)
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

  it('loads leader headshots through the combiner at 2x the 48px avatar', async () => {
    api.fetchStatLeaders.mockResolvedValue(statsLeaders.data)
    api.fetchTeamStatsList.mockResolvedValue(statsTeams.data)
    wrap(<StatsPage />)
    const [topScorer] = statsLeaders.data.categories.pts
    const [img] = await screen.findAllByAltText(topScorer.player)
    expect(img.getAttribute('src')).toMatch(/^https:\/\/a\.espncdn\.com\/combiner\/i\?img=\/i\/headshots\/nba\/players\/full\/\d+\.png&w=96&h=96$/)
    expect(document.querySelectorAll('img[src*="/i/headshots/"]:not([src*="/combiner/"])')).toHaveLength(0)
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
