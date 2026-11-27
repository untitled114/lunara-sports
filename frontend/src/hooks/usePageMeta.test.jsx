import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
vi.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ timezone: 'ET', refreshInterval: 30 }) }))
vi.mock('@/services/api', async () => ({
  ...(await vi.importActual('@/services/api')),
  fetchStandings: vi.fn(),
  fetchTeams: vi.fn(),
  fetchPlayerDetail: vi.fn(),
  fetchPlayerStats: vi.fn(),
  fetchPlayerGameLog: vi.fn(),
}))
import * as api from '@/services/api'
import { usePageMeta } from './usePageMeta'
import StandingsPage from '@/pages/StandingsPage'
import PlayerProfilePage from '@/pages/PlayerProfilePage'
// Real captures (e2e/fixtures/README.md): GET /standings, /teams and Bam Adebayo (4066261).
import REAL_STANDINGS from '../../e2e/fixtures/api/standings.json'
import REAL_TEAMS from '../../e2e/fixtures/api/teams.json'
import REAL_BAM from '../../e2e/fixtures/api/players_4066261.json'
import REAL_BAM_STATS from '../../e2e/fixtures/api/players_4066261_stats.json'
import REAL_BAM_LOG from '../../e2e/fixtures/api/players_4066261_log.json'

const description = () => document.querySelector('meta[name="description"]')?.getAttribute('content')

describe('usePageMeta', () => {
  beforeEach(() => {
    document.title = ''
    document.querySelector('meta[name="description"]')?.remove()
  })

  it('sets "<title> | Lunara Sports" and the description', () => {
    renderHook(() => usePageMeta('Standings', 'NBA standings for both conferences, with the playoff and play-in lines.'))
    expect(document.title).toBe('Standings | Lunara Sports')
    expect(description()).toBe('NBA standings for both conferences, with the playoff and play-in lines.')
  })

  it('the home page is just "Lunara Sports"', () => {
    renderHook(() => usePageMeta('Lunara Sports', 'Every NBA game, live: scores, play by play, box scores, standings and stats. Free, no account.'))
    expect(document.title).toBe('Lunara Sports')
  })

  it('Standings sets its own title and description', async () => {
    api.fetchStandings.mockResolvedValue(REAL_STANDINGS)
    api.fetchTeams.mockResolvedValue(REAL_TEAMS)
    render(<MemoryRouter><StandingsPage /></MemoryRouter>)
    await screen.findAllByRole('table')
    expect(document.title).toBe('Standings | Lunara Sports')
    expect(description()).toBe('NBA standings for both conferences, with the playoff and play-in lines.')
  })

  it("a player's page is titled with the player's name once it loads", async () => {
    api.fetchPlayerDetail.mockResolvedValue(REAL_BAM)
    api.fetchPlayerStats.mockResolvedValue(REAL_BAM_STATS)
    api.fetchPlayerGameLog.mockResolvedValue(REAL_BAM_LOG)
    render(
      <MemoryRouter initialEntries={['/player/4066261']}>
        <Routes>
          <Route path="/player/:id" element={<PlayerProfilePage />} />
        </Routes>
      </MemoryRouter>
    )
    await screen.findAllByText(REAL_BAM.name)
    // The title is set by an effect right after the name renders.
    await waitFor(() => expect(document.title).toBe(`${REAL_BAM.name} | Lunara Sports`))
    expect(description()).toBe(`${REAL_BAM.name}'s season, game log and career.`)
  })
})
