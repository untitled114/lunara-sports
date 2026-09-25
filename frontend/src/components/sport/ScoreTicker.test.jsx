import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { formatLongDay } from '@/lib/et'
import gamesOct03 from '@/test/fixtures/gamesOct03.json'
import gamesNext from '@/test/fixtures/gamesNext.json'
import gamesJan15Final from '@/test/fixtures/gamesJan15Final.json'

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ playGlassClick: vi.fn(), playThud: vi.fn(), timezone: 'local' }),
}))

const useScoreboardMock = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/useScoreboard', () => ({ useScoreboard: useScoreboardMock }))

import { ScoreTicker } from './ScoreTicker'

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

// Real scheduled game from GET /games/?game_date=2026-10-03 (see fixture _source).
const scheduledGame = gamesOct03.data[0]

// A real, completed game (GET /games/?game_date=2026-01-15) with its status
// overridden to 'live' plus a clock/quarter — a genuine live snapshot isn't
// obtainable right now (no games are in progress at capture time), so this
// exercises the live-game render branch on otherwise-real team/venue data.
const liveGame = { ...gamesJan15Final.data[0], status: 'live', quarter: 3, clock: '5:32' }

const finalGames = gamesJan15Final.data.slice(0, 2)

beforeEach(() => {
  useScoreboardMock.mockReset()
  global.fetch = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ScoreTicker', () => {
  it('loading: shows a single inline skeleton, no game content', () => {
    useScoreboardMock.mockReturnValue({ games: [], connected: false, loading: true })
    const { container } = wrap(<ScoreTicker />)
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByText('No games today')).toBeNull()
  })

  it('empty: plain "No games today" text plus a next-game link once the lookup resolves', async () => {
    useScoreboardMock.mockReturnValue({ games: [], connected: false, loading: false })
    global.fetch.mockResolvedValue({ ok: true, json: async () => gamesNext.data })
    wrap(<ScoreTicker />)
    expect(screen.getByText('No games today')).toBeInTheDocument()
    const label = `Next game: ${formatLongDay(gamesNext.data.date)} →`
    const link = await screen.findByRole('link', { name: label })
    expect(link).toHaveAttribute('href', `/scoreboard?date=${gamesNext.data.date}`)
  })

  it('empty: the next-game link centres its text on the "No games today" line', async () => {
    useScoreboardMock.mockReturnValue({ games: [], connected: false, loading: false })
    global.fetch.mockResolvedValue({ ok: true, json: async () => gamesNext.data })
    wrap(<ScoreTicker />)
    const link = await screen.findByRole('link', { name: /Next game/ })
    // Mobile links get a 36px min-height; inline-flex + items-center keeps the text on
    // the same line as the plain "No games today" text instead of 9px above it.
    expect(link).toHaveClass('inline-flex', 'items-center')
    expect(link.parentElement).toHaveClass('flex', 'items-center')
  })

  it('empty: a failed next-game lookup keeps "No games today" and shows no link', async () => {
    useScoreboardMock.mockReturnValue({ games: [], connected: false, loading: false })
    global.fetch.mockResolvedValue({ ok: false, json: async () => ({}) })
    wrap(<ScoreTicker />)
    expect(screen.getByText('No games today')).toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.queryByRole('link', { name: /Next game/ })).toBeNull()
  })

  it('scheduled: shows tip-off time and a "games today" status (not live, not all final)', () => {
    useScoreboardMock.mockReturnValue({ games: [scheduledGame], connected: false, loading: false })
    wrap(<ScoreTicker />)
    expect(screen.getByText(`${scheduledGame.away_team}`)).toBeInTheDocument()
    expect(screen.getByText(`${scheduledGame.home_team}`)).toBeInTheDocument()
    expect(screen.getByText('1 games today')).toBeInTheDocument()
  })

  it('live: shows the Live badge, a tabular clock, and a "{n} live" status', () => {
    useScoreboardMock.mockReturnValue({ games: [liveGame], connected: true, loading: false })
    wrap(<ScoreTicker />)
    expect(screen.getByText('Live')).toBeInTheDocument()
    const clock = screen.getByText(liveGame.clock)
    expect(clock).toHaveClass('tnum')
    expect(screen.getByText('1 live')).toBeInTheDocument()
  })

  it('all-final: status reads "Final scores"', () => {
    useScoreboardMock.mockReturnValue({ games: finalGames, connected: false, loading: false })
    wrap(<ScoreTicker />)
    expect(screen.getByText('Final scores')).toBeInTheDocument()
  })
})
