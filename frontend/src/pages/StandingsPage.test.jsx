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

// Real responses, byte for byte: GET https://api.lunara-app.com/standings and
// GET https://api.lunara-app.com/teams, the e2e captures (provenance in
// e2e/fixtures/README.md), re-fetched 2026-09-25 and still identical. Since D13 both
// use Utah's canonical "UTA" and /teams lists 30 teams.
import FIXTURE from '../../e2e/fixtures/api/standings.json'
import TEAMS_FIXTURE from '../../e2e/fixtures/api/teams.json'

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

  it('toggling to Division shows the 6 division headings and 5 rows each; per-table dividers follow that division’s own seed mix', async () => {
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

    // Computed from the real fixture's seeds per division (5/6 and 7/8 tiebreak swaps
    // included): Atlantic, Southeast, Northwest and Pacific each hold a seed 1-6, a
    // seed 7-10 and a seed 11-15 team, so both dividers show; Central and Southwest
    // have no seed 7-10 team, so only the play-in (top-10/rest) line shows.
    const both = ['atlantic', 'southeast', 'northwest', 'pacific']
    const playInOnly = ['central', 'southwest']
    for (const name of both) {
      const container = screen.getByTestId(`division-${name}`)
      expect(within(container).getByText('Playoff line')).toBeInTheDocument()
      expect(within(container).getByText('Play-in line')).toBeInTheDocument()
    }
    for (const name of playInOnly) {
      const container = screen.getByTestId(`division-${name}`)
      expect(within(container).queryByText('Playoff line')).not.toBeInTheDocument()
      expect(within(container).getByText('Play-in line')).toBeInTheDocument()
    }

    expect(screen.queryByText('Eastern Conference')).not.toBeInTheDocument()
  })

  it('orders by seed, not by the API rank order, and draws each line at its seed boundary (real, unmodified capture)', async () => {
    // The real 2025–26 East has ATL at rank 5 / seed 6 and TOR at rank 6 / seed 5, so
    // the API's array order (by rank) and seed order disagree there.
    const atl = FIXTURE.eastern.find((t) => t.abbrev === 'ATL')
    const tor = FIXTURE.eastern.find((t) => t.abbrev === 'TOR')
    expect([atl.rank, atl.seed, tor.rank, tor.seed]).toEqual([5, 6, 6, 5])
    fetchStandings.mockResolvedValue(FIXTURE)
    renderPage()

    await screen.findByText('Eastern Conference')
    const text = screen.getByTestId('conference-eastern').textContent
    expect(text.indexOf('Toronto Raptors')).toBeLessThan(text.indexOf('Atlanta Hawks'))

    // Every team sits in its own seed band: 1–6 above the playoff line, 7–10 between the
    // lines, 11+ below the play-in line.
    const playoff = text.indexOf('Playoff line')
    const playIn = text.indexOf('Play-in line')
    expect(playoff).toBeGreaterThan(-1)
    expect(playIn).toBeGreaterThan(playoff)
    for (const t of FIXTURE.eastern) {
      const at = text.indexOf(t.name)
      if (t.seed <= 6) expect(at, t.name).toBeLessThan(playoff)
      else if (t.seed <= 10) expect(at > playoff && at < playIn, t.name).toBe(true)
      else expect(at, t.name).toBeGreaterThan(playIn)
    }
  })

  it('sorting by a column header reorders the table (controlled DataTable sort, restored from the base)', async () => {
    fetchStandings.mockResolvedValue(FIXTURE)
    renderPage()

    await screen.findByText('Eastern Conference')
    const eastern = screen.getByTestId('conference-eastern')

    const beforeText = eastern.textContent
    expect(beforeText.indexOf('Detroit Pistons')).toBeLessThan(beforeText.indexOf('Washington Wizards'))

    const [lButton] = within(eastern).getAllByRole('button', { name: 'L' })
    await userEvent.click(lButton)

    const afterText = eastern.textContent
    expect(afterText.indexOf('Washington Wizards')).toBeLessThan(afterText.indexOf('Detroit Pistons'))
    expect(within(eastern).getByRole('columnheader', { name: 'L' })).toHaveAttribute('aria-sort', 'descending')
  })

  it('shows a Key (Playoff/Play-in via Badge) and a Details glossary in plain words', async () => {
    fetchStandings.mockResolvedValue(FIXTURE)
    renderPage()

    await screen.findByText('Eastern Conference')

    expect(screen.getByText('Key')).toBeInTheDocument()
    expect(screen.getByText('Details')).toBeInTheDocument()
    expect(screen.getByText('Playoff')).toBeInTheDocument()
    expect(screen.getAllByText('Play-in').length).toBeGreaterThan(0)
    expect(screen.getByText(/clinch a playoff spot/)).toBeInTheDocument()
    expect(screen.getByText(/play-in tournament/)).toBeInTheDocument()
    expect(screen.getByText('Games behind the conference leader')).toBeInTheDocument()
    expect(screen.getByText('Win percentage')).toBeInTheDocument()
    expect(screen.getByText('Record in the last 10 games')).toBeInTheDocument()
    expect(screen.getByText('Current win or loss streak')).toBeInTheDocument()
  })

  it('uses the em dash for every empty value, including GB for the conference leader', async () => {
    fetchStandings.mockResolvedValue(FIXTURE)
    renderPage()

    await screen.findByText('Eastern Conference')
    const eastern = screen.getByTestId('conference-eastern')

    expect(within(eastern).queryByText('-')).not.toBeInTheDocument()
    const detroitRow = within(eastern).getByText('Detroit Pistons').closest('tr')
    expect(within(detroitRow).getByText('—')).toBeInTheDocument()
  })
})
