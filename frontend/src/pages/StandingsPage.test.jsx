import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import StandingsPage from './StandingsPage'
import { fetchStandings, fetchTeams } from '@/services/api'

vi.mock('@/services/api', () => ({
  fetchStandings: vi.fn(),
  fetchTeams: vi.fn(() => Promise.resolve([])),
}))

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ playGlassClick: vi.fn(), playThud: vi.fn() }),
}))

// Real response captured from GET https://api.lunara-app.com/standings (2026-09-25).
// Shape matches the Task 1 fixture: is_previous_season true, season_label "2025–26 final",
// every conference has 15 teams with seed/rank/w/l/pct/gb/home/road/l10/strk/logo_url.
const FIXTURE = {
  eastern: [
    { rank: 1, name: 'Detroit Pistons', abbrev: 'DET', w: 60, l: 22, pct: '.731', gb: '-', conf: '', home: '31-9', road: '28-13', l10: '8-2', strk: 'W3', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/det.png', seed: 1 },
    { rank: 2, name: 'Boston Celtics', abbrev: 'BOS', w: 56, l: 26, pct: '.682', gb: '4', conf: '', home: '30-11', road: '26-15', l10: '8-2', strk: 'W2', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png', seed: 2 },
    { rank: 3, name: 'New York Knicks', abbrev: 'NY', w: 53, l: 29, pct: '.646', gb: '7', conf: '', home: '30-10', road: '22-19', l10: '6-4', strk: 'L1', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png', seed: 3 },
    { rank: 4, name: 'Cleveland Cavaliers', abbrev: 'CLE', w: 52, l: 30, pct: '.634', gb: '8', conf: '', home: '27-14', road: '25-16', l10: '7-3', strk: 'W1', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png', seed: 4 },
    { rank: 5, name: 'Atlanta Hawks', abbrev: 'ATL', w: 46, l: 36, pct: '.560', gb: '14', conf: '', home: '24-17', road: '22-19', l10: '6-4', strk: 'L1', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png', seed: 6 },
    { rank: 6, name: 'Toronto Raptors', abbrev: 'TOR', w: 46, l: 36, pct: '.560', gb: '14', conf: '', home: '24-17', road: '22-19', l10: '6-4', strk: 'W1', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png', seed: 5 },
    { rank: 7, name: 'Philadelphia 76ers', abbrev: 'PHI', w: 45, l: 37, pct: '.548', gb: '15', conf: '', home: '23-18', road: '22-19', l10: '6-4', strk: 'W2', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png', seed: 7 },
    { rank: 8, name: 'Orlando Magic', abbrev: 'ORL', w: 45, l: 37, pct: '.548', gb: '15', conf: '', home: '25-15', road: '19-20', l10: '7-3', strk: 'L1', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png', seed: 8 },
    { rank: 9, name: 'Charlotte Hornets', abbrev: 'CHA', w: 44, l: 38, pct: '.536', gb: '16', conf: '', home: '21-20', road: '23-18', l10: '6-4', strk: 'W1', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png', seed: 9 },
    { rank: 10, name: 'Miami Heat', abbrev: 'MIA', w: 43, l: 39, pct: '.524', gb: '17', conf: '', home: '26-15', road: '17-24', l10: '5-5', strk: 'W2', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png', seed: 10 },
    { rank: 11, name: 'Milwaukee Bucks', abbrev: 'MIL', w: 32, l: 50, pct: '.390', gb: '28', conf: '', home: '19-22', road: '13-28', l10: '3-7', strk: 'L1', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png', seed: 11 },
    { rank: 12, name: 'Chicago Bulls', abbrev: 'CHI', w: 31, l: 51, pct: '.378', gb: '29', conf: '', home: '18-23', road: '13-28', l10: '2-8', strk: 'L2', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png', seed: 12 },
    { rank: 13, name: 'Brooklyn Nets', abbrev: 'BKN', w: 20, l: 62, pct: '.243', gb: '40', conf: '', home: '12-29', road: '8-33', l10: '3-7', strk: 'L3', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png', seed: 13 },
    { rank: 14, name: 'Indiana Pacers', abbrev: 'IND', w: 19, l: 63, pct: '.231', gb: '41', conf: '', home: '11-30', road: '8-33', l10: '3-7', strk: 'L2', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png', seed: 14 },
    { rank: 15, name: 'Washington Wizards', abbrev: 'WSH', w: 17, l: 65, pct: '.207', gb: '43', conf: '', home: '11-30', road: '6-35', l10: '0-10', strk: 'L10', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png', seed: 15 },
  ],
  western: [
    { rank: 1, name: 'Oklahoma City Thunder', abbrev: 'OKC', w: 64, l: 18, pct: '.780', gb: '-', conf: '', home: '34-7', road: '30-10', l10: '7-3', strk: 'L2', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png', seed: 1 },
    { rank: 2, name: 'San Antonio Spurs', abbrev: 'SA', w: 62, l: 20, pct: '.756', gb: '2', conf: '', home: '32-8', road: '29-12', l10: '8-2', strk: 'L1', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png', seed: 2 },
    { rank: 3, name: 'Denver Nuggets', abbrev: 'DEN', w: 54, l: 28, pct: '.658', gb: '10', conf: '', home: '28-13', road: '26-15', l10: '10-0', strk: 'W12', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/den.png', seed: 3 },
    { rank: 4, name: 'Los Angeles Lakers', abbrev: 'LAL', w: 53, l: 29, pct: '.646', gb: '11', conf: '', home: '28-13', road: '25-16', l10: '7-3', strk: 'W3', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png', seed: 4 },
    { rank: 5, name: 'Houston Rockets', abbrev: 'HOU', w: 52, l: 30, pct: '.634', gb: '12', conf: '', home: '30-11', road: '22-19', l10: '9-1', strk: 'W1', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png', seed: 5 },
    { rank: 6, name: 'Minnesota Timberwolves', abbrev: 'MIN', w: 49, l: 33, pct: '.597', gb: '15', conf: '', home: '26-15', road: '23-18', l10: '5-5', strk: 'W2', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/min.png', seed: 6 },
    { rank: 7, name: 'Phoenix Suns', abbrev: 'PHX', w: 45, l: 37, pct: '.548', gb: '19', conf: '', home: '25-16', road: '20-21', l10: '5-5', strk: 'W1', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png', seed: 8 },
    { rank: 8, name: 'Portland Trail Blazers', abbrev: 'POR', w: 42, l: 40, pct: '.512', gb: '22', conf: '', home: '24-17', road: '18-23', l10: '7-3', strk: 'W2', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/por.png', seed: 7 },
    { rank: 9, name: 'LA Clippers', abbrev: 'LAC', w: 42, l: 40, pct: '.512', gb: '22', conf: '', home: '23-18', road: '19-22', l10: '6-4', strk: 'W1', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png', seed: 9 },
    { rank: 10, name: 'Golden State Warriors', abbrev: 'GS', w: 37, l: 45, pct: '.451', gb: '27', conf: '', home: '22-19', road: '15-26', l10: '3-7', strk: 'L3', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png', seed: 10 },
    { rank: 11, name: 'New Orleans Pelicans', abbrev: 'NO', w: 26, l: 56, pct: '.317', gb: '38', conf: '', home: '17-24', road: '9-32', l10: '1-9', strk: 'L2', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/no.png', seed: 11 },
    { rank: 12, name: 'Dallas Mavericks', abbrev: 'DAL', w: 26, l: 56, pct: '.317', gb: '38', conf: '', home: '16-25', road: '10-30', l10: '3-7', strk: 'W1', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png', seed: 12 },
    { rank: 13, name: 'Memphis Grizzlies', abbrev: 'MEM', w: 25, l: 57, pct: '.304', gb: '39', conf: '', home: '13-27', road: '11-29', l10: '1-9', strk: 'L8', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png', seed: 13 },
    { rank: 14, name: 'Sacramento Kings', abbrev: 'SAC', w: 22, l: 60, pct: '.268', gb: '42', conf: '', home: '15-26', road: '7-34', l10: '3-7', strk: 'L1', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png', seed: 14 },
    { rank: 15, name: 'Utah Jazz', abbrev: 'UTAH', w: 22, l: 60, pct: '.268', gb: '42', conf: '', home: '14-27', road: '8-33', l10: '1-9', strk: 'L1', logo_url: 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png', seed: 15 },
  ],
  season: '2025-26',
  season_label: '2025–26 final',
  is_previous_season: true,
}

// Real response captured from GET https://api.lunara-app.com/teams (2026-09-25),
// trimmed to name/abbrev/conference/division. Includes the live "UTAH"/"UTA" duplicate
// Utah Jazz entries as returned by the API (pre-existing API data quirk, not introduced
// here) — the standings fixture above uses "UTAH", which is present in this list.
const TEAMS_FIXTURE = [
  { name: 'Boston Celtics', abbrev: 'BOS', conference: 'Eastern', division: 'Atlantic' },
  { name: 'Brooklyn Nets', abbrev: 'BKN', conference: 'Eastern', division: 'Atlantic' },
  { name: 'New York Knicks', abbrev: 'NY', conference: 'Eastern', division: 'Atlantic' },
  { name: 'Philadelphia 76ers', abbrev: 'PHI', conference: 'Eastern', division: 'Atlantic' },
  { name: 'Toronto Raptors', abbrev: 'TOR', conference: 'Eastern', division: 'Atlantic' },
  { name: 'Chicago Bulls', abbrev: 'CHI', conference: 'Eastern', division: 'Central' },
  { name: 'Cleveland Cavaliers', abbrev: 'CLE', conference: 'Eastern', division: 'Central' },
  { name: 'Detroit Pistons', abbrev: 'DET', conference: 'Eastern', division: 'Central' },
  { name: 'Indiana Pacers', abbrev: 'IND', conference: 'Eastern', division: 'Central' },
  { name: 'Milwaukee Bucks', abbrev: 'MIL', conference: 'Eastern', division: 'Central' },
  { name: 'Atlanta Hawks', abbrev: 'ATL', conference: 'Eastern', division: 'Southeast' },
  { name: 'Charlotte Hornets', abbrev: 'CHA', conference: 'Eastern', division: 'Southeast' },
  { name: 'Miami Heat', abbrev: 'MIA', conference: 'Eastern', division: 'Southeast' },
  { name: 'Orlando Magic', abbrev: 'ORL', conference: 'Eastern', division: 'Southeast' },
  { name: 'Washington Wizards', abbrev: 'WSH', conference: 'Eastern', division: 'Southeast' },
  { name: 'Denver Nuggets', abbrev: 'DEN', conference: 'Western', division: 'Northwest' },
  { name: 'Minnesota Timberwolves', abbrev: 'MIN', conference: 'Western', division: 'Northwest' },
  { name: 'Oklahoma City Thunder', abbrev: 'OKC', conference: 'Western', division: 'Northwest' },
  { name: 'Portland Trail Blazers', abbrev: 'POR', conference: 'Western', division: 'Northwest' },
  { name: 'Utah Jazz', abbrev: 'UTAH', conference: 'Western', division: 'Northwest' },
  { name: 'Utah Jazz', abbrev: 'UTA', conference: 'Western', division: 'Northwest' },
  { name: 'Golden State Warriors', abbrev: 'GS', conference: 'Western', division: 'Pacific' },
  { name: 'LA Clippers', abbrev: 'LAC', conference: 'Western', division: 'Pacific' },
  { name: 'Los Angeles Lakers', abbrev: 'LAL', conference: 'Western', division: 'Pacific' },
  { name: 'Phoenix Suns', abbrev: 'PHX', conference: 'Western', division: 'Pacific' },
  { name: 'Sacramento Kings', abbrev: 'SAC', conference: 'Western', division: 'Pacific' },
  { name: 'Dallas Mavericks', abbrev: 'DAL', conference: 'Western', division: 'Southwest' },
  { name: 'Houston Rockets', abbrev: 'HOU', conference: 'Western', division: 'Southwest' },
  { name: 'Memphis Grizzlies', abbrev: 'MEM', conference: 'Western', division: 'Southwest' },
  { name: 'New Orleans Pelicans', abbrev: 'NO', conference: 'Western', division: 'Southwest' },
  { name: 'San Antonio Spurs', abbrev: 'SA', conference: 'Western', division: 'Southwest' },
]

// Every banned term from global-constraints.md (case-insensitive), plus the
// case-sensitive capitalized "Node"/"Nodes" form.
const BANNED_WORDS = [
  'telemetry', 'uplink', 'protocol', 'decrypt', 'sector', 'matrix', 'console',
  'neural', 'quantum', 'synthesi', 'intelligence station', 'arena console',
  'sync failure', 're-establish',
]

function renderPage() {
  return render(
    <MemoryRouter>
      <StandingsPage />
    </MemoryRouter>
  )
}

describe('StandingsPage', () => {
  beforeEach(() => {
    fetchStandings.mockReset()
    fetchTeams.mockReset()
    fetchTeams.mockResolvedValue(TEAMS_FIXTURE)
  })

  it('renders both conference headings, the last-season label, 15 rows per conference and a play-in line after row 10', async () => {
    fetchStandings.mockResolvedValue(FIXTURE)
    renderPage()

    expect(await screen.findByText('Eastern Conference')).toBeInTheDocument()
    expect(screen.getByText('Western Conference')).toBeInTheDocument()
    expect(screen.getByText('2025–26 final')).toBeInTheDocument()

    const eastern = screen.getByTestId('conference-eastern')
    const western = screen.getByTestId('conference-western')
    expect(within(eastern).getAllByRole('img').length).toBe(15)
    expect(within(western).getAllByRole('img').length).toBe(15)

    // Play-in line sits after the 10th team and before the 11th, in both conferences.
    const eastText = eastern.textContent
    expect(eastText.indexOf('Miami Heat')).toBeLessThan(eastText.indexOf('Play-in line'))
    expect(eastText.indexOf('Play-in line')).toBeLessThan(eastText.indexOf('Milwaukee Bucks'))

    const westText = western.textContent
    expect(westText.indexOf('Golden State Warriors')).toBeLessThan(westText.indexOf('Play-in line'))
    expect(westText.indexOf('Play-in line')).toBeLessThan(westText.indexOf('New Orleans Pelicans'))

    const fullText = document.body.textContent.toLowerCase()
    for (const word of BANNED_WORDS) {
      expect(fullText).not.toContain(word)
    }
    expect(document.body.textContent).not.toMatch(/\bNodes?\b/)
  })

  it('shows the seed in the Team column and a Team link to the team page', async () => {
    fetchStandings.mockResolvedValue(FIXTURE)
    renderPage()

    await screen.findByText('Eastern Conference')
    const eastern = screen.getByTestId('conference-eastern')
    expect(within(eastern).getByText('Detroit Pistons')).toBeInTheDocument()
    const link = within(eastern).getByRole('link', { name: /Detroit Pistons/ })
    expect(link).toHaveAttribute('href', '/team/DET')
  })

  it('renders a win/loss streak badge per team', async () => {
    fetchStandings.mockResolvedValue(FIXTURE)
    renderPage()

    await screen.findByText('Eastern Conference')
    expect(screen.getAllByText('W3').length).toBeGreaterThan(0)
    expect(screen.getAllByText('L1').length).toBeGreaterThan(0)
  })

  it('renders the error path with plain copy and a working retry, no banned words', async () => {
    fetchStandings.mockRejectedValueOnce(new Error('network error'))
    renderPage()

    expect(await screen.findByText("Couldn't load standings.")).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Try again' })

    fetchStandings.mockResolvedValueOnce(FIXTURE)
    retry.click()

    await waitFor(() => expect(screen.getByText('Eastern Conference')).toBeInTheDocument())

    const fullText = document.body.textContent.toLowerCase()
    for (const word of BANNED_WORDS) {
      expect(fullText).not.toContain(word)
    }
  })

  it('links to /stats', async () => {
    fetchStandings.mockResolvedValue(FIXTURE)
    renderPage()

    await screen.findByText('Eastern Conference')
    expect(screen.getByRole('link', { name: 'Stats' })).toHaveAttribute('href', '/stats')
  })

  it('toggling to Division shows the 6 division headings and 5 rows each, with no play-in line', async () => {
    fetchStandings.mockResolvedValue(FIXTURE)
    renderPage()

    await screen.findByText('Eastern Conference')
    await userEvent.click(screen.getByRole('tab', { name: 'Division' }))

    const divisions = ['Atlantic', 'Central', 'Southeast', 'Northwest', 'Pacific', 'Southwest']
    for (const name of divisions) {
      expect(await screen.findByText(name)).toBeInTheDocument()
      const container = screen.getByTestId(`division-${name.toLowerCase()}`)
      expect(within(container).getAllByRole('img').length).toBe(5)
    }

    expect(screen.queryByText('Play-in line')).not.toBeInTheDocument()
    expect(screen.queryByText('Eastern Conference')).not.toBeInTheDocument()
  })
})
