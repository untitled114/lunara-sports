import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
const sound = vi.hoisted(() => ({ playGlassClick: vi.fn(), playThud: vi.fn() }))
vi.mock('@/context/ThemeContext', () => ({ useTheme: () => sound }))
const scoreboard = vi.hoisted(() => ({ state: null, retry: null }))
vi.mock('@/hooks/useScoreboard', () => ({ useScoreboard: () => scoreboard.state }))
const api = vi.hoisted(() => ({ fetchStandings: vi.fn(), fetchNextGameDate: vi.fn() }))
// Keep the real pure helpers (buildStandingsLookup); only the network calls are mocked.
vi.mock('@/services/api', async (importOriginal) => ({ ...(await importOriginal()), ...api }))
import GamesPage from './GamesPage'

const at = (date) => render(<MemoryRouter initialEntries={[`/scoreboard?date=${date}`]}><GamesPage /></MemoryRouter>)

describe('GamesPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-09-25T14:00:00Z'))
    scoreboard.retry = vi.fn()
    scoreboard.state = { games: [], loading: false, error: false, retry: scoreboard.retry }
  })
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })
  it('empty today links to the next game day', async () => {
    api.fetchStandings.mockResolvedValue({ eastern: [], western: [], season_label: '2025–26 final', is_previous_season: true })
    api.fetchNextGameDate.mockResolvedValue('2026-10-03')
    at('2026-09-25')
    expect(await screen.findByText('No games today.')).toBeInTheDocument()
    const link = await screen.findByRole('link', { name: /Next game: Sat, Oct 3/ })
    expect(link).toHaveAttribute('href', '/scoreboard?date=2026-10-03')
    // Base had no sound on this link; the shared NextGameLink adds none.
    await userEvent.click(link)
    expect(sound.playGlassClick).not.toHaveBeenCalled()
  })
  it('while the games are loading: the loading state, never "No games today."', async () => {
    scoreboard.state = { ...scoreboard.state, loading: true }
    api.fetchStandings.mockResolvedValue({ eastern: [], western: [] })
    api.fetchNextGameDate.mockResolvedValue('2026-09-26')
    at('2026-09-25')
    await waitFor(() => expect(api.fetchStandings).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByText('No games today.')).toBeNull()
    expect(screen.queryByRole('link', { name: /Next game/ })).toBeNull()
  })
  it('a failed games load: the error state, and "Try again" retries', async () => {
    scoreboard.state = { ...scoreboard.state, error: true }
    api.fetchStandings.mockResolvedValue({ eastern: [], western: [] })
    at('2026-09-25')
    expect(await screen.findByText("Couldn't load games.")).toBeInTheDocument()
    expect(screen.queryByText('No games today.')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(scoreboard.retry).toHaveBeenCalledTimes(1)
  })
  it('no next game: plain message, no link', async () => {
    api.fetchStandings.mockResolvedValue({ eastern: [], western: [] })
    api.fetchNextGameDate.mockResolvedValue(null)
    at('2026-09-25')
    expect(await screen.findByText('No games scheduled yet.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Next game/ })).toBeNull()
  })
  it('failed next-game lookup does not claim nothing is scheduled', async () => {
    api.fetchStandings.mockResolvedValue({ eastern: [], western: [] })
    api.fetchNextGameDate.mockRejectedValue(new Error('down'))
    at('2026-09-25')
    expect(await screen.findByText('No games today.')).toBeInTheDocument()
    await waitFor(() => expect(api.fetchNextGameDate).toHaveBeenCalledWith('2026-09-25'))
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText('No games scheduled yet.')).toBeNull()
    expect(screen.queryByRole('link', { name: /Next game/ })).toBeNull()
  })
  it.each(['garbage', '2026-9-5', '2026-02-30', ''])('malformed ?date=%s falls back to today (ET)', async (bad) => {
    api.fetchStandings.mockResolvedValue({ eastern: [], western: [] })
    api.fetchNextGameDate.mockResolvedValue(null)
    at(bad)
    expect(await screen.findByText('No games today.')).toBeInTheDocument()
    expect(screen.getByText('Fri, Sep 25')).toBeInTheDocument()
    expect(api.fetchNextGameDate).toHaveBeenCalledWith('2026-09-25')
  })
  it('standings error shows retry that refetches', async () => {
    api.fetchStandings.mockRejectedValueOnce(new Error('down')).mockResolvedValue({ eastern: [], western: [] })
    api.fetchNextGameDate.mockResolvedValue(null)
    at('2026-09-25')
    expect(await screen.findByText("Couldn't load standings.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(api.fetchStandings).toHaveBeenCalledTimes(2))
  })
})
