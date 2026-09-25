import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { scan } from '../../scripts/check-design.mjs'
import PlayersPage from './PlayersPage'
import PlayerProfilePage from './PlayerProfilePage'
import * as api from '@/services/api'

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ playGlassClick: vi.fn(), playThud: vi.fn() }),
}))

vi.mock('@/services/api', () => ({
  fetchPlayers: vi.fn(),
  fetchPlayerDetail: vi.fn(),
  fetchPlayerStats: vi.fn(),
  fetchPlayerGameLog: vi.fn(),
}))

const HERE = dirname(fileURLToPath(import.meta.url))

function renderWithRouter(ui, { route = '/', path = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={path} element={ui} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PlayersPage', () => {
  it('search with no results shows the plain "no players match" copy', async () => {
    api.fetchPlayers.mockResolvedValue([])
    renderWithRouter(<PlayersPage />)

    await waitFor(() => expect(api.fetchPlayers).toHaveBeenCalled())

    const input = screen.getByPlaceholderText('Find a player')
    await userEvent.type(input, 'zzz')

    await waitFor(
      () => expect(screen.getByText('No players match "zzz".')).toBeInTheDocument(),
      { timeout: 2000 }
    )
  })

  it('shows a PageState with retry when the players fetch fails', async () => {
    api.fetchPlayers.mockRejectedValue(new Error('network down'))
    renderWithRouter(<PlayersPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })
  })
})

describe('PlayerProfilePage', () => {
  it('renders season averages as Stats with tabular values', async () => {
    api.fetchPlayerDetail.mockResolvedValue({
      id: '123',
      name: 'Test Player',
      team: 'Test Team',
      team_abbrev: 'TST',
      position: 'G',
      jersey: '7',
    })
    api.fetchPlayerStats.mockResolvedValue({ ppg: '24.5', rpg: '5.1', apg: '3.2', gp: '40' })
    api.fetchPlayerGameLog.mockResolvedValue([])

    renderWithRouter(<PlayerProfilePage />, { route: '/player/123', path: '/player/:id' })

    const value = await screen.findByText('24.5')
    expect(value).toHaveClass('tnum')
    expect(screen.getByText('Points')).toBeInTheDocument()
  })

  it('shows a PageState with retry when the player fetch fails', async () => {
    api.fetchPlayerDetail.mockRejectedValue(new Error('network down'))
    api.fetchPlayerStats.mockResolvedValue(null)
    api.fetchPlayerGameLog.mockResolvedValue([])

    renderWithRouter(<PlayerProfilePage />, { route: '/player/123', path: '/player/:id' })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })
  })

  // Real fixture shape, captured from GET /players/:id/log against the live
  // API (ruling D9: restyle only, never drop the fields the old profile
  // rendered — the pre-design-system page showed home/away, score, STL and
  // BLK for every recent game and it still must).
  it('keeps the home/away marker, final score, and STL/BLK on every game row', async () => {
    api.fetchPlayerDetail.mockResolvedValue({
      id: '4701230',
      name: 'Jalen Johnson',
      team: 'Atlanta Hawks',
      team_abbrev: 'ATL',
      position: 'F',
      jersey: '1',
    })
    api.fetchPlayerStats.mockResolvedValue({ ppg: '22.5', rpg: '10.3', apg: '7.9', gp: 72 })
    api.fetchPlayerGameLog.mockResolvedValue([
      {
        date: '2026-04-30',
        team: 'ATL',
        opponent: 'NY',
        home_away: 'vs',
        pts: 21,
        reb: 8,
        ast: 6,
        stl: 2,
        blk: 1,
        fg: '7-15',
        three: '2-5',
        min: '32',
        result: 'L',
        score: '140-89',
      },
    ])

    renderWithRouter(<PlayerProfilePage />, { route: '/player/123', path: '/player/:id' })

    // opponent cell combines home/away + opponent, e.g. "vs NY" (was dropped
    // entirely in a prior pass of this rollout)
    await screen.findByText('vs NY')

    expect(screen.getByRole('columnheader', { name: 'Score' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'STL' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'BLK' })).toBeInTheDocument()

    const score = screen.getByText('140-89')
    expect(score).toHaveClass('tnum')
    const stl = screen.getByText('2')
    expect(stl).toHaveClass('tnum')
    const blk = screen.getByText('1')
    expect(blk).toHaveClass('tnum')
  })
})

describe('design guardrails', () => {
  it('PlayersPage.jsx and PlayerProfilePage.jsx contain no banned copy', () => {
    for (const rel of ['PlayersPage.jsx', 'PlayerProfilePage.jsx']) {
      const text = readFileSync(join(HERE, rel), 'utf8')
      const result = scan(text, `src/pages/${rel}`)
      expect(result.banned).toBeUndefined()
    }
  })
})
