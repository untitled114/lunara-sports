import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import TeamsPage from './TeamsPage'
import TeamDetailPage from './TeamDetailPage'
import { scan } from '../../scripts/check-design.mjs'
import { fetchTeams, fetchTeamDetail, fetchTeamRoster, fetchTeamSchedule, fetchStandings, fetchTeamStatsList } from '@/services/api'

vi.mock('@/services/api', async () => {
  const actual = await vi.importActual('@/services/api')
  return {
    ...actual,
    fetchTeams: vi.fn(),
    fetchTeamDetail: vi.fn(),
    fetchTeamRoster: vi.fn(),
    fetchTeamSchedule: vi.fn(),
    fetchStandings: vi.fn(),
    fetchTeamStatsList: vi.fn(),
  }
})

const sound = vi.hoisted(() => ({ playGlassClick: vi.fn(), playThud: vi.fn() }))
vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => sound,
}))

// Real captures only, nothing hand-built:
// - e2e/fixtures/api/*.json: GET /teams, /standings, /teams/MIA, /teams/MIA/roster
//   (provenance in e2e/fixtures/README.md; MIA re-fetched 2026-09-25, byte-identical).
// - src/test/fixtures/{team,roster}-{DET,CHI}.json: GET /teams/DET(/roster) and
//   /teams/CHI(/roster), captured with curl on 2026-09-25 (see each file's _source).
import REAL_TEAMS from '../../e2e/fixtures/api/teams.json'
import REAL_STANDINGS from '../../e2e/fixtures/api/standings.json'
import REAL_MIA from '../../e2e/fixtures/api/teams_MIA.json'
import REAL_MIA_ROSTER from '../../e2e/fixtures/api/teams_MIA_roster.json'
import REAL_DET from '@/test/fixtures/team-DET.json'
import REAL_DET_ROSTER from '@/test/fixtures/roster-DET.json'
import REAL_CHI from '@/test/fixtures/team-CHI.json'
import REAL_CHI_ROSTER from '@/test/fixtures/roster-CHI.json'
// Washington's real roster as the API returns it after the experience fix (see _source).
import WSH_ROSTER from '@/test/fixtures/roster-WSH-20261125.json'
// Cleveland's real games through the Eastern-time schedule code (see _source).
import CLE_SCHEDULE from '@/test/fixtures/schedule-CLE-20261126.json'
// Cleveland's own team record and roster (GET /teams/CLE and /teams/CLE/roster, see _source),
// so the schedule tests show Cleveland's games on Cleveland's page.
import REAL_CLE from '@/test/fixtures/team-CLE-20261126.json'
import REAL_CLE_ROSTER from '@/test/fixtures/roster-CLE-20261126.json'
// The teams list and the 2026-27 standings of the same day (no games between the captures).
import TEAMS_NOW from '@/test/fixtures/teams-20261126.json'
import STANDINGS_NOW from '@/test/fixtures/standings-20261126.json'
// GET /stats/teams as the API computes it from ESPN's statistics/byteam (see _source).
import TEAM_STATS from '@/test/fixtures/statsTeams2027.json'

const row = (abbrev) => [...REAL_STANDINGS.eastern, ...REAL_STANDINGS.western].find((t) => t.abbrev === abbrev)
const BAM = REAL_MIA_ROSTER.find((p) => p.name === 'Bam Adebayo')

function renderTeamDetail(abbrev = 'MIA') {
  return render(
    <MemoryRouter initialEntries={[`/team/${abbrev}`]}>
      <Routes>
        <Route path="/team/:abbrev" element={<TeamDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

function mockTeam(detail, roster) {
  fetchTeamDetail.mockResolvedValue(detail)
  fetchStandings.mockResolvedValue(REAL_STANDINGS)
  fetchTeamRoster.mockResolvedValue(roster)
  fetchTeamSchedule.mockResolvedValue([])
  fetchTeamStatsList.mockResolvedValue([])
}

describe('TeamsPage', () => {
  const openTeams = async () => {
    fetchTeams.mockResolvedValue(TEAMS_NOW.data)
    fetchStandings.mockResolvedValue(STANDINGS_NOW.data)
    const view = render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>
    )
    await screen.findByText('Atlanta Hawks')
    return view
  }

  it('three division boxes across: East on top, West below, in division order', async () => {
    await openTeams()
    const east = screen.getByTestId('conference-Eastern')
    const west = screen.getByTestId('conference-Western')
    expect(east.compareDocumentPosition(west) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (const [conf, divs] of [[east, ['Atlantic', 'Central', 'Southeast']], [west, ['Northwest', 'Pacific', 'Southwest']]]) {
      expect(within(conf).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(divs)
      expect(within(conf).getByTestId('division-grid')).toHaveClass('md:grid-cols-3')
    }
  })

  it('each team is one roomy row: logo, full name, this season\'s record and the last game, one link', async () => {
    const { container } = await openTeams()
    const bos = TEAMS_NOW.data.find((x) => x.abbrev === 'BOS')
    const rec = STANDINGS_NOW.data.eastern.find((x) => x.abbrev === 'BOS')
    const link = screen.getByRole('link', { name: /Boston Celtics/ })
    expect(link).toHaveAttribute('href', '/team/BOS')
    expect(link.querySelector('img')).not.toBeNull()
    expect(within(link).getByText('Boston Celtics')).toHaveClass('t-body')
    expect(link).toHaveTextContent(`${rec.w}-${rec.l}`)
    expect(link).toHaveTextContent(bos.last_game.split(' ').slice(1).join(' '))
    expect(container.querySelectorAll('a[href^="/team/"]')).toHaveLength(30)
  })

  it('uses the whole page column (no narrower box of its own)', async () => {
    const { container } = await openTeams()
    expect(container.firstElementChild.className).not.toMatch(/max-w-/)
  })

  it("no records while the standings are last season's", async () => {
    fetchTeams.mockResolvedValue(TEAMS_NOW.data)
    fetchStandings.mockResolvedValue(REAL_STANDINGS)
    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>
    )
    const link = await screen.findByRole('link', { name: /Boston Celtics/ })
    const last = REAL_STANDINGS.eastern.find((x) => x.abbrev === 'BOS')
    expect(link).not.toHaveTextContent(`${last.w}-${last.l}`)
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
    mockTeam(REAL_MIA, REAL_MIA_ROSTER)
    renderTeamDetail('MIA')

    await screen.findByText('Miami Heat')
    expect(screen.getByAltText('MIA logo')).toHaveClass('h-14', 'w-14')

    // recordLine: real 2025-26 final 43-39, prefixed because is_previous_season is true.
    expect(await screen.findByText('2025\u201326: 43-39')).toBeInTheDocument()

    expect(await screen.findByRole('columnheader', { name: 'Player' })).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    // Bam Adebayo links to his real ESPN id.
    const bam = await screen.findByRole('link', { name: /Bam Adebayo/ })
    expect(BAM.id).toBe('4066261')
    expect(bam).toHaveAttribute('href', '/player/4066261')

  })

  it('uses the whole page column (a rem cap is only about 728px at the 13px root)', async () => {
    mockTeam(REAL_CLE.data, REAL_CLE_ROSTER.data)
    const { container } = renderTeamDetail('CLE')
    await screen.findByText('Cleveland Cavaliers')
    expect(container.firstElementChild.className).not.toMatch(/max-w-/)
  })

  it('the Exp column shows the experience the API gives, never a made-up "R"', async () => {
    mockTeam(REAL_MIA, WSH_ROSTER.data)
    renderTeamDetail('MIA')
    const ayton = WSH_ROSTER.data.find((p) => p.name === 'Deandre Ayton')
    expect(ayton.experience).toBe('9')
    const row = (await screen.findByRole('link', { name: /Deandre Ayton/ })).closest('tr')
    expect(within(row).getByText('9')).toBeInTheDocument()
    const rookie = WSH_ROSTER.data.find((p) => p.experience === 'R')
    if (rookie) {
      const rrow = screen.getByRole('link', { name: new RegExp(rookie.name) }).closest('tr')
      expect(within(rrow).getByText('R')).toBeInTheDocument()
    }
  })

  it('Schedule: the next five games soonest first, with the Eastern day and tip time', async () => {
    mockTeam(REAL_CLE.data, REAL_CLE_ROSTER.data)
    fetchTeamSchedule.mockResolvedValue(CLE_SCHEDULE.data)
    renderTeamDetail('CLE')
    await screen.findByText('Cleveland Cavaliers')
    await userEvent.click(screen.getByRole('tab', { name: 'Schedule' }))
    const next5 = CLE_SCHEDULE.data.filter((g) => g.status !== 'Final').slice(0, 5)
    const table = (await screen.findByRole('heading', { name: 'Upcoming' })).parentElement.parentElement.querySelector('table')
    const rows = [...table.querySelectorAll('tbody tr')]
    expect(rows).toHaveLength(5)
    expect(within(rows[0]).getByText(next5[0].day)).toBeInTheDocument()
    expect(within(rows[0]).getByText(next5[0].tip)).toBeInTheDocument()
    expect(within(rows[0]).getByText('Scheduled')).toBeInTheDocument()
  })

  it('Schedule: a game whose start has passed but never went final (postponed, canceled, stale) is not Upcoming', async () => {
    // The real Cleveland schedule read at noon ET on Mon Nov 30: the Sun Nov 29 game's record
    // still says Scheduled, with its start a day past.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-30T17:00:00Z'))
    mockTeam(REAL_CLE.data, REAL_CLE_ROSTER.data)
    fetchTeamSchedule.mockResolvedValue(CLE_SCHEDULE.data)
    renderTeamDetail('CLE')
    await screen.findByText('Cleveland Cavaliers')
    await userEvent.click(screen.getByRole('tab', { name: 'Schedule' }))
    const stale = CLE_SCHEDULE.data.find((g) => g.day === 'Sun, Nov 29')
    expect(stale.status).toBe('Scheduled')
    const table = (await screen.findByRole('heading', { name: 'Upcoming' })).parentElement.parentElement.querySelector('table')
    const first = table.querySelector('tbody tr')
    expect(within(first).queryByText('Sun, Nov 29')).toBeNull()
    expect(within(first).getByText('Tue, Dec 1')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('Schedule: the last five results, newest first, each score shown once', async () => {
    mockTeam(REAL_CLE.data, REAL_CLE_ROSTER.data)
    fetchTeamSchedule.mockResolvedValue(CLE_SCHEDULE.data)
    renderTeamDetail('CLE')
    await screen.findByText('Cleveland Cavaliers')
    await userEvent.click(screen.getByRole('tab', { name: 'Schedule' }))
    const last5 = CLE_SCHEDULE.data.filter((g) => g.status === 'Final').slice(-5).reverse()
    const table = (await screen.findByRole('heading', { name: 'Recent results' })).parentElement.parentElement.querySelector('table')
    const rows = [...table.querySelectorAll('tbody tr')]
    expect(rows).toHaveLength(5)
    expect(within(rows[0]).getByText(last5[0].day)).toBeInTheDocument()
    expect(within(table).queryByRole('columnheader', { name: 'Score' })).toBeNull()
    expect(within(rows[0]).getAllByText(new RegExp(last5[0].score))).toHaveLength(1)
  })

  it('a roster player without experience shows "-"', async () => {
    const [first] = WSH_ROSTER.data
    mockTeam(REAL_MIA, [{ ...first, experience: '' }])
    renderTeamDetail('MIA')
    const row = (await screen.findByRole('link', { name: new RegExp(first.name) })).closest('tr')
    expect(within(row).queryByText('R')).toBeNull()
    expect(within(row).getAllByText('-').length).toBeGreaterThan(0)
  })

  it('shows PageState on a fetch error, with a working retry', async () => {
    fetchTeamDetail.mockRejectedValueOnce(new Error('team not found'))
    fetchStandings.mockResolvedValue(REAL_STANDINGS)

    renderTeamDetail('MIA')

    await screen.findByText("Couldn't load this team.")
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('Stats tab is built from the standings row already loaded for the team', async () => {
    mockTeam(REAL_MIA, REAL_MIA_ROSTER)
    const mia = row('MIA')

    renderTeamDetail('MIA')
    await screen.findByText('Miami Heat')

    await userEvent.click(screen.getByRole('tab', { name: 'Stats' }))

    // SectionHeader aside = season_label.
    expect(await screen.findByRole('heading', { name: 'Season stats' })).toBeInTheDocument()
    expect(screen.getByText(REAL_STANDINGS.season_label)).toBeInTheDocument()

    // W, L, PCT, GB, Home, Road, L10 from the real standings row.
    for (const v of [mia.w, mia.l, mia.pct, mia.gb, mia.home, mia.road, mia.l10]) {
      expect(screen.getAllByText(String(v)).length).toBeGreaterThan(0)
    }

    // is_previous_season is true: no stale "current streak".
    expect(REAL_STANDINGS.is_previous_season).toBe(true)
    expect(screen.queryByText('Streak')).not.toBeInTheDocument()
    expect(screen.queryByText(mia.strk)).not.toBeInTheDocument()

    // Real seed 10: the plain seed, in the hero and in the Stats tab's seed line.
    expect(screen.getAllByText(/#10\b/).length).toBeGreaterThanOrEqual(1)
  })

  it("Stats tab adds the team's per-game line from ESPN, with its league rank", async () => {
    mockTeam(REAL_MIA, REAL_MIA_ROSTER)
    fetchTeamStatsList.mockClear().mockResolvedValue(TEAM_STATS.data)
    const mia = TEAM_STATS.data.find((r) => r.abbrev === 'MIA')
    renderTeamDetail('MIA')
    await screen.findByText('Miami Heat')
    await userEvent.click(screen.getByRole('tab', { name: 'Stats' }))

    expect(await screen.findByRole('heading', { name: 'Per game' })).toBeInTheDocument()
    expect(screen.getByText(`#${mia.rank} of 30 in point differential`)).toBeInTheDocument()
    for (const [label, value] of [['Points', mia.ppg], ['Opponent points', mia.opp_ppg], ['Turnovers', mia.tov]]) {
      expect(within(screen.getByText(label).parentElement).getByText(value)).toBeInTheDocument()
    }
    expect(fetchTeamStatsList).toHaveBeenCalledTimes(1)
  })

  it('Stats tab: no per-game section while the API has no row for the team', async () => {
    mockTeam(REAL_MIA, REAL_MIA_ROSTER)
    renderTeamDetail('MIA')
    await screen.findByText('Miami Heat')
    await userEvent.click(screen.getByRole('tab', { name: 'Stats' }))
    expect(await screen.findByRole('heading', { name: 'Season stats' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Per game' })).not.toBeInTheDocument()
  })

  it('Stats tab shows PageState empty when standings could not be loaded', async () => {
    fetchTeamDetail.mockResolvedValue(REAL_MIA)
    fetchStandings.mockRejectedValue(new Error('network down'))
    fetchTeamRoster.mockResolvedValue(REAL_MIA_ROSTER)
    fetchTeamSchedule.mockResolvedValue([])

    renderTeamDetail('MIA')
    await screen.findByText('Miami Heat')

    await userEvent.click(screen.getByRole('tab', { name: 'Stats' }))

    expect(await screen.findByText("Stats aren't available for this team yet.")).toBeInTheDocument()
  })

  it('restores conference rank, roster headshots with an initial fallback, and roster size', async () => {
    mockTeam(REAL_MIA, REAL_MIA_ROSTER)

    const { container } = renderTeamDetail('MIA')
    await screen.findByText('Miami Heat')
    await screen.findByText('Bam Adebayo')

    // 1. Conference rank Stat in the hero, from the real seed (10).
    expect(screen.getByText('Conference rank')).toBeInTheDocument()
    expect(screen.getAllByText('#10 East').length).toBeGreaterThanOrEqual(1)

    // 2. Roster headshots through getHeadshotUrl (the combiner); the real roster's
    // players with no headshot_url get their initial instead.
    const withShot = REAL_MIA_ROSTER.filter((p) => p.headshot_url)
    const without = REAL_MIA_ROSTER.filter((p) => !p.headshot_url)
    expect(without.length).toBeGreaterThan(0)
    const avatars = container.querySelectorAll('img[src*="headshots"]')
    expect(avatars.length).toBe(withShot.length)
    expect([...avatars].some((a) => a.getAttribute('src').includes('4066261.png'))).toBe(true)
    // Heights keep their units on one line (6' 9" never splits).
    expect(screen.getAllByText(BAM.height)[0]).toHaveClass('whitespace-nowrap')

    // 3. Roster size restored near the tab bar.
    expect(screen.getByText(`Roster size: ${REAL_MIA_ROSTER.length}`)).toBeInTheDocument()
  })

  it('the GB "Leader" wording for the real conference leader (DET, gb "-")', async () => {
    expect(row('DET').gb).toBe('-')
    mockTeam(REAL_DET.data, REAL_DET_ROSTER.data)
    renderTeamDetail('DET')
    await screen.findByText('Detroit Pistons')
    await userEvent.click(screen.getByRole('tab', { name: 'Stats' }))
    expect(await screen.findByText('Leader')).toBeInTheDocument()
    expect(screen.getAllByText('East #1').length).toBeGreaterThanOrEqual(1)
  })

  it('a team seeded 11+ gets no seed badge but still shows its conference rank (real CHI, seed 12)', async () => {
    expect(row('CHI').seed).toBe(12)
    mockTeam(REAL_CHI.data, REAL_CHI_ROSTER.data)
    renderTeamDetail('CHI')
    await screen.findByText('Chicago Bulls')
    expect(screen.queryByText('Play-in')).not.toBeInTheDocument()
    expect(screen.getAllByText('#12 East').length).toBeGreaterThanOrEqual(1)
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
