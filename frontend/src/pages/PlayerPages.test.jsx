import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { scan } from '../../scripts/check-design.mjs'
import PlayersPage from './PlayersPage'
import PlayerProfilePage from './PlayerProfilePage'
import * as api from '@/services/api'
import { getHeadshotUrl } from '@/utils/teamColors'
// Real e2e captures (see e2e/fixtures/README.md): GET /players, and player 4066261
// (Bam Adebayo) with his stats and game log.
import REAL_PLAYERS from '../../e2e/fixtures/api/players.json'
import REAL_BAM from '../../e2e/fixtures/api/players_4066261.json'
import REAL_BAM_STATS from '../../e2e/fixtures/api/players_4066261_stats.json'
import REAL_BAM_LOG from '../../e2e/fixtures/api/players_4066261_log.json'
import REAL_NO_JERSEY from '@/test/fixtures/player-5107157.json'

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
  it('loads small combiner headshots (2x the 44px avatar) and keeps heights on one line', async () => {
    api.fetchPlayers.mockResolvedValue(REAL_PLAYERS)
    renderWithRouter(<PlayersPage />)
    const [first] = REAL_PLAYERS[0].players
    const img = await screen.findByAltText(first.name)
    expect(img).toHaveAttribute('src', getHeadshotUrl(first.headshot_url, 88))
    expect(document.querySelectorAll('img[src*="/i/headshots/"]:not([src*="/combiner/"])')).toHaveLength(0)
    expect(screen.getAllByText(first.height)[0]).toHaveClass('whitespace-nowrap')
  })

  it('renders no lone "#" for a player with no jersey, and centres number and name together', async () => {
    api.fetchPlayers.mockResolvedValue(REAL_PLAYERS)
    renderWithRouter(<PlayersPage />)
    // Real roster rows: Dorian Finney-Smith has jersey "" in GET /players; Nickeil
    // Alexander-Walker has "7".
    const noNumber = await screen.findByRole('link', { name: 'Dorian Finney-Smith' })
    const numberSlot = noNumber.previousElementSibling
    expect(numberSlot).toHaveTextContent(/^$/)
    expect(screen.queryAllByText('#', { exact: true })).toHaveLength(0)
    const named = screen.getByRole('link', { name: 'Nickeil Alexander-Walker' })
    expect(named.previousElementSibling).toHaveTextContent('#7')
    expect(named).toHaveClass('inline-flex', 'items-center')
    expect(named.parentElement).toHaveClass('flex', 'items-center')
  })

  it('search with no results shows the plain "no players match" copy', async () => {
    // GET /players?search=zzz on the live API answers [] (checked 2026-09-25).
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
    api.fetchPlayerDetail.mockResolvedValue(REAL_BAM)
    api.fetchPlayerStats.mockResolvedValue(REAL_BAM_STATS)
    api.fetchPlayerGameLog.mockResolvedValue(REAL_BAM_LOG)

    renderWithRouter(<PlayerProfilePage />, { route: '/player/4066261', path: '/player/:id' })

    const [value] = await screen.findAllByText(REAL_BAM_STATS.ppg)
    expect(value).toHaveClass('tnum')
    expect(screen.getByText('Points')).toBeInTheDocument()
  })

  it('shows a PageState with retry when the player fetch fails', async () => {
    api.fetchPlayerDetail.mockRejectedValue(new Error('network down'))
    api.fetchPlayerStats.mockResolvedValue(null)
    api.fetchPlayerGameLog.mockResolvedValue([])

    renderWithRouter(<PlayerProfilePage />, { route: '/player/4066261', path: '/player/:id' })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })
  })

  // Real GET /players/4066261/log capture (ruling D9: restyle only, never drop the
  // fields the old profile rendered — the pre-design-system page showed home/away,
  // score, STL and BLK for every recent game and it still must).
  it('keeps the home/away marker, final score, and STL/BLK on every game row', async () => {
    api.fetchPlayerDetail.mockResolvedValue(REAL_BAM)
    api.fetchPlayerStats.mockResolvedValue(REAL_BAM_STATS)
    api.fetchPlayerGameLog.mockResolvedValue(REAL_BAM_LOG)

    renderWithRouter(<PlayerProfilePage />, { route: '/player/4066261', path: '/player/:id' })

    // The real Apr 12 game: vs ATL, W 143-117, 3 STL, 2 BLK.
    const game = REAL_BAM_LOG.find((g) => g.date === '2026-04-12')
    expect([game.home_away, game.opponent, game.score, game.stl, game.blk]).toEqual(['vs', 'ATL', '143-117', 3, 2])
    const score = await screen.findByText(game.score)
    const tr = score.closest('tr')
    const cells = within(tr)

    // opponent cell combines home/away + opponent, e.g. "vs ATL"
    expect(cells.getByText('vs ATL')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Score' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'STL' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'BLK' })).toBeInTheDocument()

    expect(score).toHaveClass('tnum')
    const headers = [...tr.closest('table').querySelectorAll('th')].map((th) => th.textContent)
    const cell = (label) => tr.querySelectorAll('td')[headers.indexOf(label)]
    expect(cell('STL')).toHaveTextContent(String(game.stl))
    expect(cell('STL')).toHaveClass('tnum')
    expect(cell('BLK')).toHaveTextContent(String(game.blk))
    expect(cell('BLK')).toHaveClass('tnum')
    // An ISO date never splits at its hyphens.
    expect(cells.getByText(game.date)).toHaveClass('whitespace-nowrap')
  })

  it('loads the headshot at 2x its 80px size through the combiner, and the tabs never overflow', async () => {
    api.fetchPlayerDetail.mockResolvedValue(REAL_BAM)
    api.fetchPlayerStats.mockResolvedValue(REAL_BAM_STATS)
    api.fetchPlayerGameLog.mockResolvedValue(REAL_BAM_LOG)

    renderWithRouter(<PlayerProfilePage />, { route: '/player/4066261', path: '/player/:id' })

    const img = await screen.findByAltText('Bam Adebayo')
    expect(img).toHaveAttribute('src', getHeadshotUrl(REAL_BAM.headshot_url, 160))
    expect(screen.getByRole('tablist')).toHaveClass('max-w-full', 'overflow-x-auto', 'scrollbar-hide')
    // Tab icons only from sm up, so the three labels fit at 390 without clipping.
    for (const tab of screen.getAllByRole('tab')) {
      const icon = tab.querySelector('svg')
      expect(icon).toHaveClass('hidden', 'sm:block')
    }
  })

  it('shows no invented jersey number when the player has none', async () => {
    // Real GET /players/5107157 (Ryan Conwell, jersey ""): the old code printed "#00".
    api.fetchPlayerDetail.mockResolvedValue(REAL_NO_JERSEY.data)
    api.fetchPlayerStats.mockResolvedValue(null)
    api.fetchPlayerGameLog.mockResolvedValue([])
    renderWithRouter(<PlayerProfilePage />, { route: '/player/5107157', path: '/player/:id' })
    await screen.findByRole('heading', { name: 'Ryan Conwell' })
    expect(screen.queryByText(/#00/)).toBeNull()
    expect(screen.queryByText(/^#/)).toBeNull()
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
