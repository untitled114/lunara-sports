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
// GET /stats/players as the API computes it from live ESPN (see _source).
import PLAYER_TABLE from '@/test/fixtures/playerTable-20261126.json'
import TEAMS_NOW from '@/test/fixtures/teams-20261126.json'
// Real e2e captures (see e2e/fixtures/README.md): GET /players, and player 4066261
// (Bam Adebayo) with his stats and game log.
import REAL_PLAYERS from '../../e2e/fixtures/api/players.json'
import REAL_BAM from '../../e2e/fixtures/api/players_4066261.json'
import REAL_BAM_STATS from '../../e2e/fixtures/api/players_4066261_stats.json'
import REAL_BAM_LOG from '../../e2e/fixtures/api/players_4066261_log.json'
import REAL_NO_JERSEY from '@/test/fixtures/player-5107157.json'
// Luka Doncic's real record, and his season line as the API computes it from ESPN (see _source).
import LUKA from '@/test/fixtures/player-3945274.json'
import LUKA_LINE from '@/test/fixtures/playerSeasonLine-3945274.json'

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ playGlassClick: vi.fn(), playThud: vi.fn() }),
}))

vi.mock('@/services/api', () => ({
  fetchPlayers: vi.fn(),
  fetchPlayerTable: vi.fn(),
  fetchTeams: vi.fn(() => Promise.resolve([])),
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
  const TABLE = PLAYER_TABLE.data
  const keyOf = (params = {}) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== false))
    const k = Object.keys(p).sort()
    if (k.length === 0) return 'default'
    if (k.join() === 'page' && p.page === 2) return 'page_2'
    if (k.join() === 'sort' && p.sort === 'reb') return 'sort_reb'
    if (k.join() === 'q' && p.q === 'knicks 11') return 'q_knicks_11'
    if (k.join() === 'all,team' && p.team === 'NY') return 'team_NY_all'
    if (k.join() === 'all') return 'all'
    return null
  }
  const COLUMNS = ['Player', 'Team', 'Pos', 'Age', 'GP', 'MIN', 'PTS', 'REB', 'AST', '3PM', 'STL', 'BLK', 'FG%', '3P%', 'FT%']
  const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)

  beforeEach(() => {
    api.fetchTeams.mockResolvedValue(TEAMS_NOW.data)
    api.fetchPlayerTable.mockImplementation((params) => {
      const key = keyOf(params)
      return key ? Promise.resolve(TABLE[key]) : new Promise(() => {})
    })
  })

  it('the default table: every column, points high to low, 25 rows, each one link, and the count', async () => {
    renderWithRouter(<PlayersPage />)
    await screen.findByText('Showing 1-25 of 277')
    expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((h) => h.textContent.replace(/[▲▼]/g, ''))).toEqual(COLUMNS)
    expect(bodyRows()).toHaveLength(25)
    const luka = TABLE.default.rows[0]
    const link = within(bodyRows()[0]).getByRole('link', { name: new RegExp(luka.player) })
    expect(link).toHaveAttribute('href', `/player/${luka.player_id}`)
    expect(link.querySelector('img')).not.toBeNull()
    expect(bodyRows()[0]).toHaveTextContent(luka.pts)
    expect(screen.getByRole('columnheader', { name: /PTS/ })).toHaveAttribute('aria-sort', 'descending')
    expect(api.fetchPlayerTable).toHaveBeenCalledWith({})
  })

  it('clicking a column header sorts the whole list by it, highest first', async () => {
    const user = userEvent.setup()
    renderWithRouter(<PlayersPage />)
    await screen.findByText('Showing 1-25 of 277')
    await user.click(screen.getByRole('button', { name: 'REB' }))
    expect(api.fetchPlayerTable).toHaveBeenLastCalledWith({ sort: 'reb' })
    await waitFor(() => expect(bodyRows()[0]).toHaveTextContent(TABLE.sort_reb.rows[0].player))
    expect(screen.getByRole('columnheader', { name: /REB/ })).toHaveAttribute('aria-sort', 'descending')
    await user.click(screen.getByRole('button', { name: /REB/ }))
    expect(api.fetchPlayerTable).toHaveBeenLastCalledWith({ sort: 'reb', dir: 'asc' })
  })

  it('pages through 25 at a time', async () => {
    const user = userEvent.setup()
    renderWithRouter(<PlayersPage />)
    await screen.findByText('Showing 1-25 of 277')
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(api.fetchPlayerTable).toHaveBeenLastCalledWith({ page: 2 })
    expect(await screen.findByText('Showing 26-50 of 277')).toBeInTheDocument()
    expect(bodyRows()[0]).toHaveTextContent(TABLE.page_2.rows[0].player)
  })

  it('search finds a team and a number: "knicks 11" is Jalen Brunson', async () => {
    const user = userEvent.setup()
    renderWithRouter(<PlayersPage />)
    await screen.findByText('Showing 1-25 of 277')
    await user.type(screen.getByRole('searchbox', { name: /Search/ }), 'knicks 11')
    await waitFor(() => expect(api.fetchPlayerTable).toHaveBeenLastCalledWith({ q: 'knicks 11' }))
    await waitFor(() => expect(bodyRows()).toHaveLength(1))
    expect(bodyRows()[0]).toHaveTextContent('Jalen Brunson')
  })

  it('the games switch is on by default; off shows all 482, and filters combine with it', async () => {
    const user = userEvent.setup()
    renderWithRouter(<PlayersPage />)
    await screen.findByText('Showing 1-25 of 277')
    const games = screen.getByRole('checkbox', { name: "Played 70% of his team's games" })
    expect(games).toBeChecked()
    await user.click(games)
    expect(api.fetchPlayerTable).toHaveBeenLastCalledWith({ all: true })
    expect(await screen.findByText('Showing 1-25 of 482')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Team' }), 'NY')
    expect(api.fetchPlayerTable).toHaveBeenLastCalledWith({ all: true, team: 'NY' })
    expect(await screen.findByText('Showing 1-17 of 17')).toBeInTheDocument()
  })

  it('shows a PageState with retry when the table cannot load', async () => {
    api.fetchPlayerTable.mockRejectedValueOnce(new Error('down'))
    renderWithRouter(<PlayersPage />)
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
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

  it('Detailed stats shows the whole season line ESPN gives', async () => {
    api.fetchPlayerDetail.mockResolvedValue(LUKA.data)
    api.fetchPlayerStats.mockResolvedValue(LUKA_LINE.data)
    api.fetchPlayerGameLog.mockResolvedValue([])
    renderWithRouter(<PlayerProfilePage />, { route: '/player/3945274', path: '/player/:id' })
    await userEvent.click(await screen.findByRole('tab', { name: /Detailed stats/ }))
    expect(await screen.findByText('2026-27 per game')).toBeInTheDocument()
    for (const label of ['Started', 'Minutes', 'Field goals', 'Offensive', 'Defensive', 'Turnovers', 'Fouls', 'Double-doubles', 'Triple-doubles']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByText(LUKA_LINE.data.fg)).toBeInTheDocument()
    expect(screen.getByText(LUKA_LINE.data.mpg)).toBeInTheDocument()
  })

  it('a field an older response lacks shows "-", never a made-up zero', async () => {
    api.fetchPlayerDetail.mockResolvedValue(REAL_BAM)
    api.fetchPlayerStats.mockResolvedValue(REAL_BAM_STATS)
    api.fetchPlayerGameLog.mockResolvedValue(REAL_BAM_LOG)
    renderWithRouter(<PlayerProfilePage />, { route: '/player/4066261', path: '/player/:id' })
    await userEvent.click(await screen.findByRole('tab', { name: /Detailed stats/ }))
    expect(REAL_BAM_STATS.mpg).toBeUndefined()
    const minutes = screen.getByText('Minutes').parentElement
    expect(within(minutes).getByText('-')).toBeInTheDocument()
  })

  it('no season stats: an empty state, not a grid of zeros', async () => {
    api.fetchPlayerDetail.mockResolvedValue(REAL_BAM)
    api.fetchPlayerStats.mockResolvedValue(null)
    api.fetchPlayerGameLog.mockResolvedValue([])
    renderWithRouter(<PlayerProfilePage />, { route: '/player/4066261', path: '/player/:id' })
    await userEvent.click(await screen.findByRole('tab', { name: /Detailed stats/ }))
    expect(await screen.findByText('No season stats for this player yet.')).toBeInTheDocument()
    expect(screen.queryByText('0.0')).toBeNull()
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

  // Real GET /players/4066261/log capture (restyled only: never drop the
  // fields the old profile rendered - the pre-design-system page showed home/away,
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
