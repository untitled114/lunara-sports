import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
vi.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ playGlassClick: vi.fn(), playThud: vi.fn() }) }))
vi.mock('@/hooks/useScoreboard', () => ({ useScoreboard: () => ({ games: [] }) }))
const api = vi.hoisted(() => ({ fetchStandings: vi.fn(), fetchNextGameDate: vi.fn() }))
// Keep the real pure helpers (buildStandingsLookup); only the network calls are mocked.
vi.mock('@/services/api', async (importOriginal) => ({ ...(await importOriginal()), ...api }))
import GamesPage from './GamesPage'

const at = (date) => render(<MemoryRouter initialEntries={[`/scoreboard?date=${date}`]}><GamesPage /></MemoryRouter>)

describe('GamesPage', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); vi.setSystemTime(new Date('2026-09-25T14:00:00Z')) })
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })
  it('empty today links to the next game day', async () => {
    api.fetchStandings.mockResolvedValue({ eastern: [], western: [], season_label: '2025–26 final', is_previous_season: true })
    api.fetchNextGameDate.mockResolvedValue('2026-10-03')
    at('2026-09-25')
    expect(await screen.findByText('No games today.')).toBeInTheDocument()
    const link = await screen.findByRole('link', { name: /Next game: Sat, Oct 3/ })
    expect(link).toHaveAttribute('href', '/scoreboard?date=2026-10-03')
  })
  it('no next game: plain message, no link', async () => {
    api.fetchStandings.mockResolvedValue({ eastern: [], western: [] })
    api.fetchNextGameDate.mockResolvedValue(null)
    at('2026-09-25')
    expect(await screen.findByText('No games scheduled yet.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Next game/ })).toBeNull()
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
