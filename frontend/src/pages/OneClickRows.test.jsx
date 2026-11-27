import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

vi.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ timezone: 'ET', refreshInterval: 30 }) }))
vi.mock('@/services/api', async () => ({
  ...(await vi.importActual('@/services/api')),
  fetchPlayers: vi.fn(),
  fetchPlayerTable: vi.fn(),
  fetchStandings: vi.fn(),
  fetchTeams: vi.fn(),
  fetchStatLeaders: vi.fn(),
  fetchTeamStatsList: vi.fn(),
  fetchCategoryLeaders: vi.fn(),
  fetchTeamDetail: vi.fn(),
  fetchTeamRoster: vi.fn(),
  fetchTeamSchedule: vi.fn(),
  fetchBoxScore: vi.fn(() => Promise.resolve(null)),
  fetchPlays: vi.fn(() => Promise.resolve([])),
}))
import * as api from '@/services/api'
import PlayersPage from './PlayersPage'
import StandingsPage from './StandingsPage'
import LeadersPage from './LeadersPage'
import StatsPage from './StatsPage'
import TeamDetailPage from './TeamDetailPage'
import { BoxScore, FullBoxScore } from '@/components/sport/BoxScore'
import { LiveFeed } from '@/components/sport/LiveFeed'

// Real captures only (provenance in e2e/fixtures/README.md and each file's _source).
import REAL_STANDINGS from '../../e2e/fixtures/api/standings.json'
import REAL_TEAMS from '../../e2e/fixtures/api/teams.json'
import REAL_MIA from '../../e2e/fixtures/api/teams_MIA.json'
import REAL_MIA_ROSTER from '../../e2e/fixtures/api/teams_MIA_roster.json'
import leaders25 from '@/test/fixtures/statsLeaders25.json'
import statsTeams from '@/test/fixtures/statsTeams.json'
import LEADERS5 from '@/test/fixtures/statsLeaders5-20261126.json'
import STATS_CATEGORY from '@/test/fixtures/statsCategory-20261126.json'
import PLAYER_TABLE from '@/test/fixtures/playerTable-20261126.json'
// MIA @ PHI tonight (final 104-111), after the ESPN reconcile.
import PLAYS from '@/test/fixtures/plays-401909317.json'
import BOX from '@/test/fixtures/boxscore-401909317.json'

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

function open(path, routePath, element, { teamRoute = true } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={element} />
        <Route path="/player/:id" element={<Where />} />
        {teamRoute && <Route path="/team/:abbrev" element={<Where />} />}
      </Routes>
    </MemoryRouter>
  )
}

const landed = () => screen.getByTestId('where').textContent
const linkAround = (el) => el.closest('a')

beforeEach(() => vi.clearAllMocks())

describe('one link per row, headshot or logo included', () => {
  it('Players: a table row opens the player from its headshot or any stat; the name is one link', async () => {
    const user = userEvent.setup()
    api.fetchTeams.mockResolvedValue([])
    api.fetchPlayerTable.mockResolvedValue(PLAYER_TABLE.data.default)
    open('/players', '/players', <PlayersPage />)
    const top = PLAYER_TABLE.data.default.rows[0]
    const link = await screen.findByRole('link', { name: new RegExp(top.player) })
    expect(link).toHaveAttribute('href', `/player/${top.player_id}`)
    expect(link.querySelector('img')).not.toBeNull()
    const cells = within(link.closest('tr')).getAllByRole('cell')
    await user.click(cells[cells.length - 1])
    expect(landed()).toBe(`/player/${top.player_id}`)
  })

  it('Standings: the team link holds the logo, and any cell of the row opens the team', async () => {
    const user = userEvent.setup()
    api.fetchStandings.mockResolvedValue(REAL_STANDINGS)
    api.fetchTeams.mockResolvedValue(REAL_TEAMS)
    open('/standings', '/standings', <StandingsPage />)
    const [row] = await screen.findAllByRole('row', { name: /Detroit Pistons/ })
    const link = within(row).getByRole('link', { name: /Detroit Pistons/ })
    expect(link).toHaveAttribute('href', '/team/DET')
    expect(link.querySelector('img')).not.toBeNull()
    await user.click(within(row).getAllByRole('cell')[1])
    expect(landed()).toBe('/team/DET')
  })

  it('League leaders: the player link holds the headshot, and the value cell opens the player', async () => {
    const user = userEvent.setup()
    api.fetchStatLeaders.mockResolvedValue(leaders25.data)
    open('/stats/leaders/reb', '/stats/leaders/:category', <LeadersPage />)
    const top = leaders25.data.categories.reb[0]
    const img = await screen.findByAltText(top.player)
    expect(linkAround(img)).toHaveAttribute('href', `/player/${top.player_id}`)
    const row = img.closest('tr')
    const cells = within(row).getAllByRole('cell')
    await user.click(cells[cells.length - 1])
    expect(landed()).toBe(`/player/${top.player_id}`)
  })

  it("Stats: a top-10 row opens the player from its headshot or its value", async () => {
    const user = userEvent.setup()
    api.fetchStatLeaders.mockResolvedValue(LEADERS5.data)
    api.fetchTeamStatsList.mockResolvedValue(statsTeams.data)
    api.fetchTeams.mockResolvedValue([])
    api.fetchCategoryLeaders.mockResolvedValue(STATS_CATEGORY.data.pts)
    open('/stats', '/stats', <StatsPage />)
    const top = STATS_CATEGORY.data.pts.rows[0]
    const link = await screen.findByRole('link', { name: new RegExp(top.player) })
    expect(link).toHaveAttribute('href', `/player/${top.player_id}`)
    expect(link.querySelector('img')).not.toBeNull()
    const cells = within(link.closest('tr')).getAllByRole('cell')
    await user.click(cells[cells.length - 1])
    expect(landed()).toBe(`/player/${top.player_id}`)
  })

  it('Team roster: the player link holds the headshot, and the number cell opens the player', async () => {
    const user = userEvent.setup()
    api.fetchTeamDetail.mockResolvedValue(REAL_MIA)
    api.fetchStandings.mockResolvedValue(REAL_STANDINGS)
    api.fetchTeamRoster.mockResolvedValue(REAL_MIA_ROSTER)
    api.fetchTeamSchedule.mockResolvedValue([])
    api.fetchTeamStatsList.mockResolvedValue([])
    open('/team/MIA', '/team/:abbrev', <TeamDetailPage />, { teamRoute: false })
    const link = await screen.findByRole('link', { name: /Bam Adebayo/ })
    expect(link.querySelector('img')).not.toBeNull()
    await user.click(within(link.closest('tr')).getAllByRole('cell')[0])
    expect(landed()).toBe('/player/4066261')
  })

  it('Full box score: the player link holds the headshot, and a stat cell opens the player', async () => {
    const user = userEvent.setup()
    open('/', '/', <FullBoxScore gameId="401909317" homeTeam="PHI" awayTeam="MIA" status="final" boxData={BOX.data} />)
    const [img] = document.querySelectorAll('img[src*="/4066261.png"]')
    const link = linkAround(img)
    expect(link).toHaveAttribute('href', '/player/4066261')
    expect(link).toHaveTextContent('Bam Adebayo')
    const cells = within(img.closest('tr')).getAllByRole('cell')
    await user.click(cells[cells.length - 1])
    expect(landed()).toBe('/player/4066261')
  })

  it('On-court panel: every headshot is inside its player link', () => {
    const { container } = open('/', '/', (
      <BoxScore gameId="401909317" homeTeam="PHI" awayTeam="MIA" status="final" side="away" plays={PLAYS.data} boxData={BOX.data} />
    ))
    const shots = container.querySelectorAll('img[src*="/headshots/"]')
    expect(shots.length).toBeGreaterThan(0)
    for (const img of shots) expect(linkAround(img)?.getAttribute('href')).toMatch(/^\/player\/\d+$/)
  })

  it('Feed: names are dotted-underline links; both players in a substitution are links', () => {
    const sub = PLAYS.data.find((p) => p.description === 'Bobby Portis enters the game for Bam Adebayo')
    const basket = PLAYS.data.find((p) => p.description === 'Giannis Antetokounmpo makes driving layup (Davion Mitchell assists)')
    open('/', '/', (
      <LiveFeed gameId="401909317" status="final" homeTeam="PHI" awayTeam="MIA" plays={[basket, sub]} connected boxData={BOX.data} />
    ))
    const giannis = screen.getByRole('link', { name: /Antetokounmpo/ })
    expect(giannis).toHaveAttribute('href', '/player/3032977')
    expect(giannis).toHaveClass('decoration-dotted')
    expect(screen.getByRole('link', { name: /Portis/ })).toHaveAttribute('href', '/player/3064482')
    expect(screen.getByRole('link', { name: /Adebayo/ })).toHaveAttribute('href', '/player/4066261')
  })
})
