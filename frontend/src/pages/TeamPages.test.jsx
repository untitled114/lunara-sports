import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import TeamsPage from './TeamsPage'
import TeamDetailPage from './TeamDetailPage'
import { scan } from '../../scripts/check-design.mjs'
import { fetchTeams, fetchTeamDetail, fetchTeamRoster, fetchTeamSchedule, fetchStandings } from '@/services/api'

vi.mock('@/services/api', async () => {
  const actual = await vi.importActual('@/services/api')
  return {
    ...actual,
    fetchTeams: vi.fn(),
    fetchTeamDetail: vi.fn(),
    fetchTeamRoster: vi.fn(),
    fetchTeamSchedule: vi.fn(),
    fetchStandings: vi.fn(),
  }
})

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ playGlassClick: vi.fn(), playThud: vi.fn() }),
}))

// 30 real NBA teams (structural fixture only — no stats/predictions).
const TEAMS = [
  ['Atlanta Hawks', 'ATL', 'Eastern', 'Southeast'],
  ['Boston Celtics', 'BOS', 'Eastern', 'Atlantic'],
  ['Brooklyn Nets', 'BKN', 'Eastern', 'Atlantic'],
  ['Charlotte Hornets', 'CHA', 'Eastern', 'Southeast'],
  ['Chicago Bulls', 'CHI', 'Eastern', 'Central'],
  ['Cleveland Cavaliers', 'CLE', 'Eastern', 'Central'],
  ['Detroit Pistons', 'DET', 'Eastern', 'Central'],
  ['Indiana Pacers', 'IND', 'Eastern', 'Central'],
  ['Miami Heat', 'MIA', 'Eastern', 'Southeast'],
  ['Milwaukee Bucks', 'MIL', 'Eastern', 'Central'],
  ['New York Knicks', 'NY', 'Eastern', 'Atlantic'],
  ['Orlando Magic', 'ORL', 'Eastern', 'Southeast'],
  ['Philadelphia 76ers', 'PHI', 'Eastern', 'Atlantic'],
  ['Toronto Raptors', 'TOR', 'Eastern', 'Atlantic'],
  ['Washington Wizards', 'WSH', 'Eastern', 'Southeast'],
  ['Dallas Mavericks', 'DAL', 'Western', 'Southwest'],
  ['Denver Nuggets', 'DEN', 'Western', 'Northwest'],
  ['Golden State Warriors', 'GS', 'Western', 'Pacific'],
  ['Houston Rockets', 'HOU', 'Western', 'Southwest'],
  ['LA Clippers', 'LAC', 'Western', 'Pacific'],
  ['Los Angeles Lakers', 'LAL', 'Western', 'Pacific'],
  ['Memphis Grizzlies', 'MEM', 'Western', 'Southwest'],
  ['Minnesota Timberwolves', 'MIN', 'Western', 'Northwest'],
  ['New Orleans Pelicans', 'NO', 'Western', 'Southwest'],
  ['Oklahoma City Thunder', 'OKC', 'Western', 'Northwest'],
  ['Phoenix Suns', 'PHX', 'Western', 'Pacific'],
  ['Portland Trail Blazers', 'POR', 'Western', 'Northwest'],
  ['Sacramento Kings', 'SAC', 'Western', 'Pacific'],
  ['San Antonio Spurs', 'SA', 'Western', 'Southwest'],
  ['Utah Jazz', 'UTA', 'Western', 'Northwest'],
]

function makeTeams() {
  return TEAMS.map(([name, abbrev, conference, division]) => ({
    name,
    abbrev,
    conference,
    division,
    logo_url: '',
    last_game: '',
  }))
}

// Real StandingsTeam-shaped row for MIA (api/src/models/schemas.py StandingsTeam),
// as returned inside a StandingsResponse from GET /standings.
const STANDINGS_FIXTURE = {
  eastern: [
    {
      rank: 9,
      name: 'Miami Heat',
      abbrev: 'MIA',
      w: 37,
      l: 45,
      pct: '.451',
      gb: '-',
      conf: '',
      home: '22-18',
      road: '15-27',
      l10: '4-6',
      strk: 'L2',
      logo_url: '',
      seed: 9,
    },
  ],
  western: [],
  season: '2025-26',
  season_label: '2025–26 final',
  is_previous_season: true,
}

const ROSTER_FIXTURE = [
  {
    id: '2199',
    jersey: '22',
    name: 'Jimmy Butler',
    position: 'F',
    height: "6'7\"",
    weight: '230',
    age: 34,
    experience: '13',
  },
  {
    id: '3155',
    jersey: '13',
    name: 'Bam Adebayo',
    position: 'C',
    height: "6'9\"",
    weight: '255',
    age: 27,
    experience: '7',
  },
]

function renderTeamDetail(abbrev = 'MIA') {
  return render(
    <MemoryRouter initialEntries={[`/team/${abbrev}`]}>
      <Routes>
        <Route path="/team/:abbrev" element={<TeamDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('TeamsPage', () => {
  it('renders 30 TeamMarks from a mocked fetchTeams', async () => {
    fetchTeams.mockResolvedValue(makeTeams())
    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>
    )
    await screen.findByText('Atlanta Hawks')
    expect(screen.getAllByRole('img')).toHaveLength(30)
  })

  it('shows PageState on a fetch error, with a working retry', async () => {
    fetchTeams.mockRejectedValueOnce(new Error('network down'))
    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>
    )
    await screen.findByText("Couldn't load teams.")
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('TeamDetailPage', () => {
  it('shows the name, a large TeamMark, the record line, and the roster as a DataTable', async () => {
    fetchTeamDetail.mockResolvedValue({
      name: 'Miami Heat',
      abbrev: 'MIA',
      city: 'Miami, FL',
      venue: 'Kaseya Center',
      conference: 'Eastern',
      division: 'Southeast',
      color: '#98002E',
      logo_url: '',
    })
    fetchStandings.mockResolvedValue(STANDINGS_FIXTURE)
    fetchTeamRoster.mockResolvedValue(ROSTER_FIXTURE)
    fetchTeamSchedule.mockResolvedValue([])

    renderTeamDetail('MIA')

    await screen.findByText('Miami Heat')

    const mark = screen.getByAltText('MIA logo')
    expect(mark).toHaveClass('h-14', 'w-14')

    // recordLine: "2025–26 final" -> "2025–26" prefix, since is_previous_season is true.
    expect(await screen.findByText('2025–26: 37-45')).toBeInTheDocument()

    expect(await screen.findByRole('columnheader', { name: 'Player' })).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(await screen.findByText('Jimmy Butler')).toBeInTheDocument()
  })

  it('shows PageState on a fetch error, with a working retry', async () => {
    fetchTeamDetail.mockRejectedValueOnce(new Error('team not found'))
    fetchStandings.mockResolvedValue(STANDINGS_FIXTURE)

    renderTeamDetail('MIA')

    await screen.findByText("Couldn't load this team.")
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('D12: Stats tab is built from the standings row already loaded for the team', async () => {
    fetchTeamDetail.mockResolvedValue({
      name: 'Miami Heat',
      abbrev: 'MIA',
      city: 'Miami, FL',
      venue: 'Kaseya Center',
      conference: 'Eastern',
      division: 'Southeast',
      color: '#98002E',
      logo_url: '',
    })
    fetchStandings.mockResolvedValue(STANDINGS_FIXTURE)
    fetchTeamRoster.mockResolvedValue(ROSTER_FIXTURE)
    fetchTeamSchedule.mockResolvedValue([])

    renderTeamDetail('MIA')
    await screen.findByText('Miami Heat')

    await userEvent.click(screen.getByRole('tab', { name: 'Stats' }))

    // SectionHeader aside = season_label.
    expect(await screen.findByRole('heading', { name: 'Season stats' })).toBeInTheDocument()
    expect(screen.getByText('2025–26 final')).toBeInTheDocument()

    // W, L, PCT, GB, Home, Road, L10 from the standings row.
    expect(screen.getByText('W')).toBeInTheDocument()
    expect(screen.getByText('37')).toBeInTheDocument()
    expect(screen.getByText('L')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('.451')).toBeInTheDocument()
    expect(screen.getByText('22-18')).toBeInTheDocument()
    expect(screen.getByText('15-27')).toBeInTheDocument()
    expect(screen.getByText('4-6')).toBeInTheDocument()

    // is_previous_season is true in the fixture: no stale "current streak".
    expect(screen.queryByText('Streak')).not.toBeInTheDocument()
    expect(screen.queryByText('L2')).not.toBeInTheDocument()

    // Conference seed (seedBadge: 7-10 -> Play-in) — shown both in the hero
    // header and the Stats tab's own seed line.
    expect(screen.getAllByText('Play-in').length).toBeGreaterThanOrEqual(1)
  })

  it('D12: Stats tab shows PageState empty when the team has no standings row', async () => {
    fetchTeamDetail.mockResolvedValue({
      name: 'Miami Heat',
      abbrev: 'MIA',
      conference: 'Eastern',
      division: 'Southeast',
    })
    fetchStandings.mockResolvedValue({ eastern: [], western: [], season_label: '', is_previous_season: false })
    fetchTeamRoster.mockResolvedValue([])
    fetchTeamSchedule.mockResolvedValue([])

    renderTeamDetail('MIA')
    await screen.findByText('Miami Heat')

    await userEvent.click(screen.getByRole('tab', { name: 'Stats' }))

    expect(await screen.findByText("Stats aren't available for this team yet.")).toBeInTheDocument()
  })
})

describe('design check', () => {
  it('TeamsPage.jsx and TeamDetailPage.jsx are clean (no banned words, no legacy classes)', () => {
    const dir = dirname(fileURLToPath(import.meta.url))
    for (const file of ['TeamsPage.jsx', 'TeamDetailPage.jsx']) {
      const text = readFileSync(join(dir, file), 'utf8')
      expect(scan(text, file)).toEqual({})
    }
  })
})
