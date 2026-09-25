import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import GameDetailPage, { tipOffLabel, teamNameLine, tipOffPollDelay, PRE_TIP_WINDOW_MS } from './GameDetailPage'
import { GameCard } from '@/components/sport/GameCard'
import { LiveFeed, feedEmptyText } from '@/components/sport/LiveFeed'
import { boxScoreEmptyText, onCourtLabel } from '@/components/sport/BoxScore'
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
// The scheduled MIA @ TOR opener (2026-10-03 23:00Z), the real e2e capture of
// GET /games/401902644 (its /boxscore was a real 404 and /plays a real []).
import REAL_SCHEDULED_GAME from '../../e2e/fixtures/api/games_401902644.json'
// The real GET /standings capture (2025–26 final, is_previous_season true).
import REAL_STANDINGS from '../../e2e/fixtures/api/standings.json'

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

vi.mock('@/services/api', async (importOriginal) => ({
  // The real lookup builder, so the header sees the same standings shape GameCard does.
  buildStandingsLookup: (await importOriginal()).buildStandingsLookup,
  fetchGame: vi.fn(),
  fetchStandings: vi.fn(),
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
    // The real fixture has no full-team-name field: the abbreviation shows once (TeamMark).
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
    const badge = header.getByText('Q3')
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

  it('renders a positive plus-minus with a single sign, not double', async () => {
    renderPage()
    const tables = await screen.findAllByRole('table')
    // Jonas Valanciunas' real plus-minus for this game is the API string "+16" — the cell
    // must render "+16", not "++16" (a double sign was a pre-existing bug: the render
    // prefixed "+" onto the already-signed raw string instead of the parsed number).
    let found = false
    for (const table of tables) {
      if (within(table).queryAllByText('+16').length) found = true
      expect(within(table).queryAllByText('++16')).toHaveLength(0)
    }
    expect(found).toBe(true)
  })

  it('links every box-score player to their real ESPN profile id (from the headshot), never /player/1', async () => {
    renderPage()
    await screen.findByTestId('scoreboard-header')
    await screen.findAllByText('Jonas Valanciunas')
    // GET /players/6477 on the live API is Jonas Valanciunas (checked 2026-09-25); his
    // real box-score headshot is .../players/full/6477.png.
    const links = screen.getAllByRole('link', { name: 'Jonas Valanciunas' })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(link).toHaveAttribute('href', '/player/6477')
    const hrefs = Array.from(document.querySelectorAll('a[href^="/player/"]')).map((a) => a.getAttribute('href'))
    expect(hrefs.length).toBeGreaterThan(0)
    expect(hrefs).not.toContain('/player/1')
    const ids = new Set(
      [...REAL_BOX_DATA.home.players, ...REAL_BOX_DATA.away.players].map((p) =>
        p.headshot_url.match(/full\/(\d+)\.png/)[1]
      )
    )
    for (const href of hrefs) expect(ids.has(href.slice('/player/'.length))).toBe(true)
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

  it('a final game with no plays says play-by-play is unavailable, not "Waiting for tip-off"', async () => {
    renderPage()
    expect(await screen.findByText("Play-by-play isn't available for this game.")).toBeInTheDocument()
    expect(screen.getByText('Recap')).toBeInTheDocument()
    expect(screen.queryByText('Waiting for tip-off.')).toBeNull()
    expect(screen.queryByText(/\b0 plays\b/)).toBeNull()
  })

  it('lays the on-court stats out in five equal columns so PF always fits', async () => {
    renderPage()
    await screen.findByTestId('scoreboard-header')
    const pfLabels = await screen.findAllByText('PF', { selector: 'span.t-label' })
    expect(pfLabels.length).toBeGreaterThan(0)
    for (const label of pfLabels) {
      expect(label.parentElement.parentElement).toHaveClass('grid', 'grid-cols-5')
    }
  })

  it('a scheduled game shows the tip-off day and time, no "0 0" score, and box score copy', async () => {
    api.fetchGame.mockResolvedValue(REAL_SCHEDULED_GAME)
    api.fetchBoxScore.mockRejectedValue(new Error('404'))
    api.fetchPlays.mockResolvedValue([])
    renderPage()
    const header = within(await screen.findByTestId('scoreboard-header'))
    expect(header.getByTestId('tip-off')).toHaveTextContent(/^Sat, Oct 3 · \d{1,2}:\d{2} [AP]M$/)
    expect(header.queryAllByText('0')).toHaveLength(0)
    expect(document.querySelectorAll('[data-testid="scoreboard-header"] .t-score')).toHaveLength(0)
    expect(await screen.findByText('Box score starts at tip-off.')).toBeInTheDocument()
    expect(screen.getAllByText('Waiting for tip-off.').length).toBeGreaterThan(0)
  })

  it('shows the same seed badges as GameCard for the teams that disagreed (MIA, TOR)', async () => {
    api.fetchGame.mockResolvedValue(REAL_SCHEDULED_GAME)
    api.fetchStandings.mockResolvedValue(REAL_STANDINGS)
    api.fetchBoxScore.mockRejectedValue(new Error('404'))
    api.fetchPlays.mockResolvedValue([])
    renderPage()
    const header = within(await screen.findByTestId('scoreboard-header'))
    // Real 2025–26 final standings: MIA seed 10 (rank 10), TOR seed 5 (rank 6).
    const mia = await header.findByText('Play-in')
    const tor = header.getByText('East #5')
    expect(header.queryByText(/#10|#6/)).toBeNull()
    expect(mia).toHaveAttribute('title', '2025–26 final seeding')
    expect(tor).toHaveAttribute('title', '2025–26 final seeding')
    expect(header.getByText('2025–26: 43-39')).toBeInTheDocument()

    // GameCard renders the identical badges from the same data.
    const { buildStandingsLookup } = await vi.importActual('@/services/api')
    const card = render(
      <MemoryRouter>
        <GameCard
          game={REAL_SCHEDULED_GAME}
          standings={buildStandingsLookup(REAL_STANDINGS)}
          standingsMeta={{ seasonLabel: REAL_STANDINGS.season_label, isPrev: REAL_STANDINGS.is_previous_season }}
        />
      </MemoryRouter>
    )
    expect(within(card.container).getByText('Play-in')).toHaveAttribute('title', '2025–26 final seeding')
    expect(within(card.container).getByText('East #5')).toBeInTheDocument()
  })

  it('shows the abbreviation once when the API sends no full team name', async () => {
    renderPage()
    const header = within(await screen.findByTestId('scoreboard-header'))
    expect(header.getAllByText('OKC')).toHaveLength(1)
    expect(header.getAllByText('DEN')).toHaveLength(1)
  })

  it('labels the side panels truthfully on a final game with no plays: its starters', async () => {
    renderPage()
    await screen.findByTestId('scoreboard-header')
    await screen.findAllByText('Branden Carlson')
    expect(screen.queryByText('On court')).toBeNull()
    // 2 desktop side panels + 2 stacked mobile panels, each labelled; the full box
    // score's own "Starters" row labels add to the count.
    expect(screen.getAllByText('Starters', { selector: 'span.t-label' }).length).toBeGreaterThanOrEqual(4)
  })

  it('shows PageState with a retry action when fetchGame fails', async () => {
    api.fetchGame.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText("Couldn't load this game.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('scheduled game flips to live without a reload', () => {
  const sockets = []
  class RecordingSocket {
    constructor(url) {
      this.url = url
      sockets.push(url)
    }
    send() {}
    close() {}
  }

  beforeEach(() => {
    vi.clearAllMocks()
    sockets.length = 0
    vi.stubGlobal('WebSocket', RecordingSocket)
    api.fetchStandings.mockResolvedValue(REAL_STANDINGS)
    api.fetchModelPicks.mockResolvedValue([])
    api.fetchBoxScore.mockRejectedValue(new Error('404'))
    api.fetchPlays.mockResolvedValue([])
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('polls once tip-off is near, then shows the live state and opens the live feed', async () => {
    // 40 minutes before the real MIA @ TOR tip-off (2026-10-03T23:00:00Z).
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-10-03T22:20:00Z'))
    // The page first loads the real scheduled capture. The poll's answer is the D21
    // rendering state: a real completed game (401811037) with only status/quarter/clock
    // overridden, since no live capture exists yet.
    api.fetchGame
      .mockResolvedValueOnce(REAL_SCHEDULED_GAME)
      .mockResolvedValue({ ...REAL_GAME, status: 'live', quarter: 1, clock: '11:40' })
    renderPage()
    await screen.findByTestId('tip-off')
    expect(api.fetchGame).toHaveBeenCalledTimes(1)
    expect(sockets).toHaveLength(0)

    // 9 minutes later: still outside the 30-minute window, no polling.
    await act(async () => vi.advanceTimersByTime(9 * 60 * 1000))
    expect(api.fetchGame).toHaveBeenCalledTimes(1)

    // Into the window: the next 15s poll picks up the live status.
    await act(async () => vi.advanceTimersByTime(60 * 1000))
    expect(api.fetchGame).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTime(15 * 1000))
    expect(api.fetchGame).toHaveBeenCalledTimes(2)
    const header = within(await screen.findByTestId('scoreboard-header'))
    expect(await header.findByText('Q1')).toHaveClass('text-live')
    expect(screen.queryByTestId('tip-off')).toBeNull()
    expect(sockets.some((u) => /\/ws\//.test(u))).toBe(true)
  })

  it('tipOffPollDelay: only a scheduled game with a tip-off time, 0 inside the window', () => {
    const tip = Date.parse(REAL_SCHEDULED_GAME.start_time)
    expect(tipOffPollDelay(REAL_SCHEDULED_GAME, tip - PRE_TIP_WINDOW_MS - 1000)).toBe(1000)
    expect(tipOffPollDelay(REAL_SCHEDULED_GAME, tip - PRE_TIP_WINDOW_MS)).toBe(0)
    expect(tipOffPollDelay(REAL_SCHEDULED_GAME, tip + 60 * 60 * 1000)).toBe(0) // late tip-off
    expect(tipOffPollDelay(REAL_GAME, tip)).toBeNull() // final
    expect(tipOffPollDelay({ ...REAL_SCHEDULED_GAME, start_time: null }, tip)).toBeNull()
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

describe('playerIdFromHeadshot', () => {
  it('reads the ESPN athlete id from a raw or combiner headshot URL, else null', async () => {
    const { playerIdFromHeadshot } = await import('@/utils/teamColors')
    const raw = REAL_BOX_DATA.home.players[0].headshot_url
    expect(playerIdFromHeadshot(raw)).toBe('6477')
    const { getHeadshotUrl } = await import('@/utils/teamColors')
    expect(playerIdFromHeadshot(getHeadshotUrl(raw, 96))).toBe('6477')
    // The API's schema default for a player with no headshot is "".
    expect(playerIdFromHeadshot('')).toBeNull()
    expect(playerIdFromHeadshot(undefined)).toBeNull()
  })
})

describe('status-dependent copy', () => {
  it('on-court panel label says what the panel lists', () => {
    expect(onCourtLabel('live', 120, true)).toBe('On court')
    expect(onCourtLabel('halftime', 60, true)).toBe('On court')
    expect(onCourtLabel('scheduled', 0, false)).toBe('On court')
    expect(onCourtLabel('final', 450, true)).toBe('Closing lineup')
    expect(onCourtLabel('final', 0, true)).toBe('Starters')
    expect(onCourtLabel('final', 0, false)).toBe('Players')
  })

  it('team name line: only a full name that differs from the abbreviation', () => {
    expect(teamNameLine(undefined, 'MIA')).toBeNull()
    expect(teamNameLine('MIA', 'MIA')).toBeNull()
    expect(teamNameLine('Miami Heat', 'MIA')).toBe('Miami Heat')
  })

  it('feed: only a scheduled game waits for tip-off', () => {
    expect(feedEmptyText('scheduled', false)).toBe('Waiting for tip-off.')
    expect(feedEmptyText('final', true)).toBe("Play-by-play isn't available for this game.")
    expect(feedEmptyText('final', false)).toBe("Play-by-play isn't available for this game.")
    expect(feedEmptyText('live', true)).toBe('No plays yet.')
    expect(feedEmptyText('live', false)).toBe('Connecting.')
  })

  it('box score: tip-off copy for a scheduled game, plain copy otherwise', () => {
    expect(boxScoreEmptyText('scheduled')).toBe('Box score starts at tip-off.')
    expect(boxScoreEmptyText('final')).toBe("The box score isn't available for this game.")
    expect(boxScoreEmptyText('live')).toBe('No box score yet.')
  })

  it('tip-off label: the ET calendar day, then the GameCard time format', () => {
    const fmt = () => '7:00 PM'
    expect(tipOffLabel('2026-10-03T23:00:00Z', fmt)).toBe('Sat, Oct 3 · 7:00 PM')
    // 03:30Z on Oct 4 is still Oct 3 in ET (11:30 PM EDT).
    expect(tipOffLabel('2026-10-04T03:30:00Z', fmt)).toBe('Sat, Oct 3 · 7:00 PM')
    expect(tipOffLabel(null, fmt)).toBe('TBD')
  })
})
