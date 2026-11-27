import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
  useTheme: () => ({ timezone: 'ET' }),
}))

// Real responses, byte for byte: GET /standings and
// GET /teams, the e2e captures (provenance in
// e2e/fixtures/README.md), re-fetched 2026-09-25 and still identical. Both
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

  it('one table per conference, side by side, 15 rows each, the playoff line under 6th and the play-in line under 10th', async () => {
    fetchStandings.mockResolvedValue(FIXTURE)
    const { container } = renderPage()

    expect(await screen.findByText('Eastern Conference')).toBeInTheDocument()
    expect(screen.getByText('Western Conference')).toBeInTheDocument()
    expect(screen.getByText('2025\u201326 final')).toBeInTheDocument()
    expect(screen.getByTestId('conference-eastern').parentElement).toHaveClass('lg:grid-cols-2')
    expect(container.firstElementChild).toHaveClass('2xl:-mx-[150px]')

    for (const id of ['conference-eastern', 'conference-western']) {
      const tables = within(screen.getByTestId(id)).getAllByRole('table')
      expect(tables).toHaveLength(1)
      const rows = within(tables[0]).getAllByRole('row').slice(1)
      expect(rows).toHaveLength(15)
      expect(rows[5]).toHaveClass('line-playoff')
      expect(rows[9]).toHaveClass('line-play-in')
      expect(rows.filter((r) => /\bline-/.test(r.className))).toHaveLength(2)
    }
    expect(screen.queryByText('Playoff line')).toBeNull()

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

  it('toggling to Division shows the 6 divisions, one table of 5 each; lines follow that division’s own seed mix', async () => {
    fetchStandings.mockResolvedValue(FIXTURE)
    renderPage()

    await screen.findByText('Eastern Conference')
    await userEvent.click(screen.getByRole('tab', { name: 'Division' }))

    const divisions = ['Atlantic', 'Central', 'Southeast', 'Northwest', 'Pacific', 'Southwest']
    for (const name of divisions) {
      expect(await screen.findByText(name)).toBeInTheDocument()
      const tables = within(screen.getByTestId(`division-${name.toLowerCase()}`)).getAllByRole('table')
      expect(tables).toHaveLength(1)
      expect(within(tables[0]).getAllByRole('row').slice(1)).toHaveLength(5)
    }

    // From the real fixture's seeds per division: Atlantic, Southeast, Northwest and
    // Pacific hold a seed 1-6, a seed 7-10 and a seed 11-15 team, so both lines show;
    // Central and Southwest have no seed 7-10 team, so only the play-in line shows.
    const lines = (name) => within(screen.getByTestId(`division-${name}`)).getAllByRole('row').map((r) => r.className)
    for (const name of ['atlantic', 'southeast', 'northwest', 'pacific']) {
      expect(lines(name).filter((c) => c.includes('line-playoff'))).toHaveLength(1)
      expect(lines(name).filter((c) => c.includes('line-play-in'))).toHaveLength(1)
    }
    for (const name of ['central', 'southwest']) {
      expect(lines(name).filter((c) => c.includes('line-playoff'))).toHaveLength(0)
      expect(lines(name).filter((c) => c.includes('line-play-in'))).toHaveLength(1)
    }

    expect(screen.queryByText('Eastern Conference')).not.toBeInTheDocument()
  })

  it('orders by seed, not by the API rank order, and draws each line at its seed boundary (real, unmodified capture)', async () => {
    // The real 2025-26 East has ATL at rank 5 / seed 6 and TOR at rank 6 / seed 5, so
    // the API's array order (by rank) and seed order disagree there.
    const atl = FIXTURE.eastern.find((t) => t.abbrev === 'ATL')
    const tor = FIXTURE.eastern.find((t) => t.abbrev === 'TOR')
    expect([atl.rank, atl.seed, tor.rank, tor.seed]).toEqual([5, 6, 6, 5])
    fetchStandings.mockResolvedValue(FIXTURE)
    renderPage()

    await screen.findByText('Eastern Conference')
    const rows = within(screen.getByTestId('conference-eastern')).getAllByRole('row').slice(1)
    const abbrevs = rows.map((r) => within(r).getByRole('link').getAttribute('href').replace('/team/', ''))
    expect(abbrevs).toEqual([...FIXTURE.eastern].sort((a, b) => a.seed - b.seed).map((t) => t.abbrev))
    expect(abbrevs.indexOf('TOR')).toBeLessThan(abbrevs.indexOf('ATL'))
    expect(rows.find((r) => r.className.includes('line-playoff'))).toBe(rows[abbrevs.indexOf('ATL')])
  })

  it('sorting by a column header reorders the table and drops the seed lines (controlled DataTable sort)', async () => {
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
    expect(within(eastern).getAllByRole('row').filter((r) => /\bline-/.test(r.className))).toHaveLength(0)
  })

  it('shows a Key for the two lines and a Details glossary in plain words', async () => {
    fetchStandings.mockResolvedValue(FIXTURE)
    renderPage()

    await screen.findByText('Eastern Conference')

    expect(screen.getByText('Key')).toBeInTheDocument()
    expect(screen.getByText('Details')).toBeInTheDocument()
    expect(screen.getByText('Seeds 1-6 make the playoffs: the solid orange line is under 6th.')).toBeInTheDocument()
    expect(screen.getByText('Seeds 7-10 go to the play-in tournament: the dashed line is under 10th.')).toBeInTheDocument()
    expect(screen.getByText('Games behind the conference leader')).toBeInTheDocument()
    expect(screen.getByText('Win percentage')).toBeInTheDocument()
    expect(screen.getByText('Record in the last 10 games')).toBeInTheDocument()
    expect(screen.getByText('Current win or loss streak')).toBeInTheDocument()
  })

  it('uses a plain hyphen for every empty value, including GB for the conference leader', async () => {
    fetchStandings.mockResolvedValue(FIXTURE)
    renderPage()

    await screen.findByText('Eastern Conference')
    const eastern = screen.getByTestId('conference-eastern')

    expect(eastern.textContent).not.toMatch(/\u2014/)
    const detroitRow = within(eastern).getByText('Detroit Pistons').closest('tr')
    expect(within(detroitRow).getByText('-')).toBeInTheDocument()
  })
})

describe('StandingsPage on a phone', () => {
  // jsdom has no matchMedia: the page treats that as a desktop. A phone is a stub that
  // matches the below-sm query.
  const asPhone = () => {
    window.matchMedia = vi.fn((query) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  }
  const ALL = [...FIXTURE.eastern, ...FIXTURE.western]

  beforeEach(() => {
    fetchStandings.mockReset()
    fetchStandings.mockResolvedValue(FIXTURE)
    fetchTeams.mockReset()
    fetchTeams.mockResolvedValue(TEAMS_FIXTURE)
  })
  afterEach(() => {
    delete window.matchMedia
  })

  it('desktops show the nickname (full name on hover and for screen readers); phones the abbreviation only', async () => {
    renderPage()
    const row = (await screen.findAllByRole('link', { name: /Detroit Pistons/ }))[0]
    const nick = within(row).getByText('Pistons')
    expect(nick).toHaveClass('hidden', 'sm:inline', 'truncate')
    expect(nick).toHaveAttribute('title', 'Detroit Pistons')
    expect(within(row).getByText('Detroit Pistons')).toHaveClass('sr-only')
  })

  it('the team column stays pinned while the table swipes sideways', async () => {
    asPhone()
    renderPage()
    const table = (await screen.findAllByRole('table'))[0]
    expect(table.parentElement).toHaveClass('overflow-x-auto')
    for (const row of within(table).getAllByRole('row')) {
      expect(row.firstElementChild).toHaveClass('sticky', 'left-0')
    }
  })

  it('one group at a time from the chips: East first, then West, Division and League', async () => {
    const user = userEvent.setup()
    asPhone()
    renderPage()
    const chips = await screen.findByRole('tablist', { name: 'Standings group' })
    expect(within(chips).getAllByRole('tab').map((c) => c.textContent)).toEqual(['East', 'West', 'Division', 'League'])
    expect(screen.getByTestId('conference-eastern')).toBeInTheDocument()
    expect(screen.queryByTestId('conference-western')).toBeNull()

    await user.click(within(chips).getByRole('tab', { name: 'West' }))
    expect(screen.getByTestId('conference-western')).toBeInTheDocument()
    expect(screen.queryByTestId('conference-eastern')).toBeNull()

    await user.click(within(chips).getByRole('tab', { name: 'Division' }))
    for (const d of ['atlantic', 'central', 'southeast', 'northwest', 'pacific', 'southwest']) {
      expect(screen.getByTestId(`division-${d}`)).toBeInTheDocument()
    }

    await user.click(within(chips).getByRole('tab', { name: 'League' }))
    const league = screen.getByTestId('league')
    const rows = within(league).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(30)
    const best = [...ALL].sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct))[0]
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', `/team/${best.abbrev}`)
  })

  it('a desktop keeps both conferences and the Conference and Division switch, no chips', async () => {
    renderPage()
    expect(await screen.findByTestId('conference-eastern')).toBeInTheDocument()
    expect(screen.getByTestId('conference-western')).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Standings view' })).toBeInTheDocument()
    expect(screen.queryByRole('tablist', { name: 'Standings group' })).toBeNull()
  })
})

describe('StandingsPage width', () => {
  it('uses the whole page column (a rem cap is only about 936px at the 13px root)', async () => {
    fetchStandings.mockReset()
    fetchStandings.mockResolvedValue(FIXTURE)
    fetchTeams.mockResolvedValue(TEAMS_FIXTURE)
    const { container } = renderPage()
    await screen.findAllByRole('table')
    expect(container.firstElementChild.className).not.toMatch(/max-w-/)
  })
})
