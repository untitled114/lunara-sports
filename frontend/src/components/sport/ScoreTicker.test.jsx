import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { formatLongDay } from '@/lib/et'
import gamesOct03 from '@/test/fixtures/gamesOct03.json'
import gamesNext from '@/test/fixtures/gamesNext.json'
import gamesJan15Final from '@/test/fixtures/gamesJan15Final.json'
import gamesLive from '@/test/fixtures/games-20261125-live.json'
import STANDINGS from '@/test/fixtures/standings-20261126.json'
import LAST_SEASON from '../../../e2e/fixtures/api/standings.json'
import { fetchStandings } from '@/services/api'

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ timezone: 'ET' }),
}))

vi.mock('@/services/api', async () => {
  const actual = await vi.importActual('@/services/api')
  return { ...actual, fetchStandings: vi.fn() }
})

const useScoreboardMock = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/useScoreboard', () => ({ useScoreboard: useScoreboardMock }))

import { ScoreTicker } from './ScoreTicker'

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

// Real scheduled game from GET /games/?game_date=2026-10-03 (see fixture _source).
const scheduledGame = gamesOct03.data[0]


const finalGames = gamesJan15Final.data.slice(0, 2)

// Tonight's real slate: SA @ POR live in the 4th (3:41), eight finals.
const tonight = gamesLive.data
const saPor = tonight.find((g) => g.away_team === 'SA' && g.home_team === 'POR')
const team = (abbrev) => [...STANDINGS.data.eastern, ...STANDINGS.data.western].find((t) => t.abbrev === abbrev)
const tile = (game) => screen.getByRole('link', { name: new RegExp(`${game.away_team}.*${game.home_team}`) })

beforeEach(() => {
  useScoreboardMock.mockReset()
  global.fetch = vi.fn()
  fetchStandings.mockReset()
  fetchStandings.mockResolvedValue(STANDINGS.data)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ScoreTicker', () => {
  it('loading: shows a single inline skeleton, no game content', () => {
    useScoreboardMock.mockReturnValue({ games: [], connected: false, loading: true })
    const { container } = wrap(<ScoreTicker />)
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByText('No games today.')).toBeNull()
  })

  it('empty: plain "No games today." text plus a next-game link once the lookup resolves', async () => {
    useScoreboardMock.mockReturnValue({ games: [], connected: false, loading: false })
    global.fetch.mockResolvedValue({ ok: true, json: async () => gamesNext.data })
    wrap(<ScoreTicker />)
    expect(screen.getByText('No games today.')).toBeInTheDocument()
    const label = `Next game: ${formatLongDay(gamesNext.data.date)} ->`
    const link = await screen.findByRole('link', { name: label })
    expect(link).toHaveAttribute('href', `/scoreboard?date=${gamesNext.data.date}`)
  })

  it('empty: the next-game link centres its text on the "No games today." line', async () => {
    useScoreboardMock.mockReturnValue({ games: [], connected: false, loading: false })
    global.fetch.mockResolvedValue({ ok: true, json: async () => gamesNext.data })
    wrap(<ScoreTicker />)
    const link = await screen.findByRole('link', { name: /Next game/ })
    // Mobile links get a 36px min-height; inline-flex + items-center keeps the text on
    // the same line as the plain "No games today." text instead of 9px above it.
    expect(link).toHaveClass('inline-flex', 'items-center')
    expect(link.parentElement).toHaveClass('flex', 'items-center')
  })

  it('empty: a failed next-game lookup keeps "No games today." and shows no link', async () => {
    useScoreboardMock.mockReturnValue({ games: [], connected: false, loading: false })
    global.fetch.mockResolvedValue({ ok: false, json: async () => ({}) })
    wrap(<ScoreTicker />)
    expect(screen.getByText('No games today.')).toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.queryByRole('link', { name: /Next game/ })).toBeNull()
  })

  it('error: says the games could not load (not "No games today.") and "Try again" retries', async () => {
    const retry = vi.fn()
    useScoreboardMock.mockReturnValue({ games: [], connected: false, loading: false, error: true, retry })
    wrap(<ScoreTicker />)
    expect(screen.getByText('Couldn’t load today’s games.')).toBeInTheDocument()
    expect(screen.queryByText('No games today.')).toBeNull()
    expect(screen.queryByRole('link', { name: /Next game/ })).toBeNull()
    screen.getByRole('button', { name: 'Try again' }).click()
    expect(retry).toHaveBeenCalledTimes(1)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('empty with nothing scheduled: the shared next-game copy "No games scheduled yet."', async () => {
    useScoreboardMock.mockReturnValue({ games: [], connected: false, loading: false })
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ date: null }) })
    wrap(<ScoreTicker />)
    expect(await screen.findByText('No games scheduled yet.')).toBeInTheDocument()
  })

  it('live: the tile is outlined in the live color, never the accent', () => {
    useScoreboardMock.mockReturnValue({ games: [saPor], connected: true, loading: false })
    wrap(<ScoreTicker />)
    expect(tile(saPor)).toHaveClass('border-live')
    expect(tile(saPor).className).not.toMatch(/accent/)
  })

  it('no AWAY or HOME labels; each tile is one link to its game', () => {
    useScoreboardMock.mockReturnValue({ games: tonight, connected: true, loading: false })
    const { container } = wrap(<ScoreTicker />)
    expect(container.textContent).not.toMatch(/\b(away|home)\b/i)
    const links = within(screen.getByTestId('ticker-track')).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      [saPor, ...tonight.filter((g) => g !== saPor)].map((g) => `/game/${g.id}`)
    )
    for (const a of links) expect(a.querySelector('a')).toBeNull()
  })

  it("each team row shows the team's record from this season's standings", async () => {
    useScoreboardMock.mockReturnValue({ games: [saPor], connected: true, loading: false })
    wrap(<ScoreTicker />)
    for (const abbrev of ['SA', 'POR']) {
      const t = team(abbrev)
      expect(await within(tile(saPor)).findByText(`${t.w}-${t.l}`)).toBeInTheDocument()
    }
  })

  it("no records while the standings are last season's", async () => {
    fetchStandings.mockResolvedValue(LAST_SEASON)
    useScoreboardMock.mockReturnValue({ games: [saPor], connected: true, loading: false })
    wrap(<ScoreTicker />)
    await waitFor(() => expect(fetchStandings).toHaveBeenCalled())
    await Promise.resolve()
    expect(within(tile(saPor)).queryByText(/^\d+-\d+$/)).toBeNull()
  })

  it('the trailing team is dimmed; scores use the small score size', () => {
    useScoreboardMock.mockReturnValue({ games: [saPor], connected: true, loading: false })
    wrap(<ScoreTicker />)
    const trailing = within(tile(saPor)).getByText(String(saPor.away_score))
    const leading = within(tile(saPor)).getByText(String(saPor.home_score))
    expect(trailing).toHaveClass('t-score-sm', 'text-text-3')
    expect(leading).toHaveClass('t-score-sm', 'text-text-1')
    expect(within(tile(saPor)).getByText('SA')).toHaveClass('text-text-3')
  })

  it('live reads "Live, 4th 3:41"; finals read "Final"', () => {
    useScoreboardMock.mockReturnValue({ games: tonight, connected: true, loading: false })
    wrap(<ScoreTicker />)
    expect(within(tile(saPor)).getByText('Live, 4th 3:41')).toBeInTheDocument()
    const phi = tonight.find((g) => g.home_team === 'PHI')
    expect(within(tile(phi)).getByText('Final')).toBeInTheDocument()
  })

  // Halftime and the end-of-period words ("Halftime", "End of 3rd", never a 0.0 clock) are
  // checked in lib/gameMath.test.js; no halftime record has been captured for a tile test.

  describe('scheduled tiles read the tip time in the time zone setting', () => {
    afterEach(() => vi.useRealTimers())

    it('"Tonight, 7:00 PM ET" on the day of the game', () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-03T16:00:00Z'))
      useScoreboardMock.mockReturnValue({ games: [scheduledGame], connected: false, loading: false })
      wrap(<ScoreTicker />)
      expect(within(tile(scheduledGame)).getByText('Tonight, 7:00 PM ET')).toBeInTheDocument()
    })

    it('the weekday on another day', () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-02T16:00:00Z'))
      useScoreboardMock.mockReturnValue({ games: [scheduledGame], connected: false, loading: false })
      wrap(<ScoreTicker />)
      expect(within(tile(scheduledGame)).getByText('Sat, 7:00 PM ET')).toBeInTheDocument()
    })
  })

  it('finals still render when the standings cannot load', () => {
    fetchStandings.mockRejectedValue(new Error('offline'))
    useScoreboardMock.mockReturnValue({ games: finalGames, connected: false, loading: false })
    wrap(<ScoreTicker />)
    expect(screen.getAllByText(/^Final/)).toHaveLength(finalGames.length)
  })
})
