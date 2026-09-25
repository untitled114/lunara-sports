import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import GameDetailPage from './GameDetailPage'
import { LiveFeed } from '@/components/sport/LiveFeed'
import * as api from '@/services/api'

// Real, captured API responses (frontend/src/test/fixtures/README below) — no invented
// data. Game 401811037 (DEN 127 @ home, OKC 107 away, 2026-04-10, status "final") was
// fetched live from https://api.lunara-app.com and trimmed:
//   curl 'https://api.lunara-app.com/games/401811037'
//   curl 'https://api.lunara-app.com/games/401811037/boxscore'   (kept 5 starters + 3
//     bench per team, all stat values verbatim)
//   curl 'https://api.lunara-app.com/games/401811037/plays'      (returned `[]` — see note
//     below; kept as-is)
import REAL_GAME from '@/test/fixtures/game-401811037.json'
import REAL_BOX_DATA from '@/test/fixtures/boxscore-401811037.json'
import REAL_PLAYS from '@/test/fixtures/plays-401811037.json'
// Our own live API keeps no historical play-by-play for this game (see REAL_PLAYS above —
// a real, verified `[]`) and no game is live right now, so two real plays came from ESPN's
// summary endpoint instead, mapped to our shape the same way
// ingestion/src/collectors/playbyplay.py's _parse_play does. Source URL and mapping notes
// are recorded in the fixture file itself.
import REAL_ESPN_PLAYS from '@/test/fixtures/plays-401811037-espn.json'

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

vi.mock('@/services/api', () => ({
  fetchGame: vi.fn(),
  fetchStandings: vi.fn(),
  buildStandingsLookup: () => ({}),
  fetchModelPicks: vi.fn(),
  fetchBoxScore: vi.fn(),
  fetchPlays: vi.fn(),
  addReaction: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/game/401811037']}>
      <Routes>
        <Route path="/game/:id" element={<GameDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('GameDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // status "final" here (real) means useGameFeed's isLive branch is false, so it never
    // opens a WebSocket — no WS mocking needed for this real, completed game.
    api.fetchGame.mockResolvedValue(REAL_GAME)
    api.fetchStandings.mockResolvedValue([])
    api.fetchModelPicks.mockResolvedValue([])
    api.fetchBoxScore.mockResolvedValue(REAL_BOX_DATA)
    api.fetchPlays.mockResolvedValue(REAL_PLAYS)
  })

  it('shows both TeamMarks and t-score scores in the header for the real final score', async () => {
    renderPage()
    const header = within(await screen.findByTestId('scoreboard-header'))
    // The real fixture has no separate full-team-name field, so the abbreviation appears
    // twice (TeamMark + the name line) — assert presence, not uniqueness.
    expect(header.getAllByText('OKC').length).toBeGreaterThan(0)
    expect(header.getAllByText('DEN').length).toBeGreaterThan(0)
    expect(header.getByAltText('OKC logo')).toBeInTheDocument()
    expect(header.getByAltText('DEN logo')).toBeInTheDocument()
    expect(header.getByText('107')).toHaveClass('t-score')
    expect(header.getByText('127')).toHaveClass('t-score')
    expect(header.getByText('Final')).toBeInTheDocument()
  })

  it('shows a live badge for the current quarter of a live game', async () => {
    // Rendering-state fixture: the real fixture game is "final" (no live game exists in
    // the live API right now — verified), so this overrides only the status/quarter/clock
    // fields to exercise the live-badge branch. Team identity, scores and venue stay the
    // real fixture's values.
    api.fetchGame.mockResolvedValue({ ...REAL_GAME, status: 'live', quarter: 3, clock: '7:41' })
    renderPage()
    const header = within(await screen.findByTestId('scoreboard-header'))
    const badge = header.getByText('Quarter 3')
    expect(badge).toHaveClass('text-live')
    expect(badge.querySelector('[aria-hidden]')).toBeInTheDocument()
  })

  it('renders the box score as a table with starters, bench, a totals row, and tabular numbers', async () => {
    renderPage()
    const tables = await screen.findAllByRole('table')
    expect(tables.length).toBeGreaterThan(0)

    let numericCell = null
    let sawStarters = false
    let sawBench = false
    let sawTotals = false
    for (const table of tables) {
      const t = within(table)
      if (t.queryAllByText('Starters').length) sawStarters = true
      if (t.queryAllByText('Bench').length) sawBench = true
      if (t.queryAllByText('Totals').length) sawTotals = true
      // Jonas Valanciunas' real rebound total for this game
      const matches = t.queryAllByText('17')
      if (matches.length && !numericCell) numericCell = matches[0]
    }
    expect(sawStarters).toBe(true)
    expect(sawBench).toBe(true)
    expect(sawTotals).toBe(true)
    expect(numericCell).toHaveClass('tnum')
  })

  it('shows real player headshots on the on-court and full box score cards', async () => {
    renderPage()
    await screen.findByTestId('scoreboard-header')
    // Headshot <img> tags are decorative (empty alt) — assert at least one real
    // espncdn headshot URL made it into the DOM.
    const headshotImgs = document.querySelectorAll('img[src*="headshots/nba/players"]')
    expect(headshotImgs.length).toBeGreaterThan(0)
  })

  it('has no banned copy anywhere on the page', async () => {
    renderPage()
    await screen.findByTestId('scoreboard-header')
    const banned = /telemetry|uplink|protocol|decrypt|sector|\bnode\b|\bnodes\b|matrix|neural|quantum|synthesi|intelligence station|arena console|sync failure|re-establish/i
    expect(document.body.textContent).not.toMatch(banned)
  })

  it('shows PageState with a retry action when fetchGame fails', async () => {
    api.fetchGame.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText("Couldn't load this game.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('LiveFeed play card', () => {
  // Real plays, verbatim from ESPN (see plays-401811037-espn.json for the source URL and
  // field mapping). LiveFeed renders newest-first, so [1] (Strawther's assisted layup,
  // sequence 30) is the top card and [0] (Wiggins' three, sequence 27) is second.
  const [WIGGINS_THREE, STRAWTHER_LAYUP] = REAL_ESPN_PLAYS.plays
  const PLAYS_NEWEST_FIRST = [STRAWTHER_LAYUP, WIGGINS_THREE]

  it('shows the team logo and the score after a real scoring play', () => {
    render(
      <LiveFeed
        gameId="401811037"
        status="final"
        homeTeam="DEN"
        awayTeam="OKC"
        plays={PLAYS_NEWEST_FIRST}
        connected
        boxData={REAL_BOX_DATA}
      />
    )
    // Team logo appears at least once on the play cards (avatar fallback + name line, for
    // both the OKC and DEN plays).
    const teamLogos = document.querySelectorAll('img[src*="teamlogos/nba"]')
    expect(teamLogos.length).toBeGreaterThan(0)
    // Score after each real play — read the score-row spans directly (not RTL's getByText,
    // since "4" legitimately repeats: Strawther's play is 4-4, Wiggins' is 2-4).
    const scoreTexts = Array.from(document.querySelectorAll('.tnum.font-semibold')).map(
      (el) => el.textContent
    )
    expect(scoreTexts).toContain('2') // Wiggins' home score after his three (2-4, real)
    expect(scoreTexts.filter((t) => t === '4').length).toBeGreaterThanOrEqual(2) // both plays' "4"s
  })

  it('shows the real assist on the assisted play', () => {
    render(
      <LiveFeed
        gameId="401811037"
        status="final"
        homeTeam="DEN"
        awayTeam="OKC"
        plays={PLAYS_NEWEST_FIRST}
        connected
        boxData={REAL_BOX_DATA}
      />
    )
    // "Julian Strawther makes layup (Bruce Brown assists)" — real ESPN text — should
    // surface the real assisting player on the assist line, with a team logo beside it.
    expect(screen.getByText('B. Brown')).toBeInTheDocument()
  })
})
