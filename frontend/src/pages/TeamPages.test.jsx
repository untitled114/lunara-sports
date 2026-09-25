import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
}

describe('TeamsPage', () => {
  it('renders a TeamMark for each of the 30 real teams', async () => {
    fetchTeams.mockResolvedValue(REAL_TEAMS)
    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>
    )
    await screen.findByText('Atlanta Hawks')
    expect(REAL_TEAMS).toHaveLength(30)
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
    mockTeam(REAL_MIA, REAL_MIA_ROSTER)
    renderTeamDetail('MIA')

    await screen.findByText('Miami Heat')
    expect(screen.getByAltText('MIA logo')).toHaveClass('h-14', 'w-14')

    // recordLine: real 2025–26 final 43-39, prefixed because is_previous_season is true.
    expect(await screen.findByText('2025–26: 43-39')).toBeInTheDocument()

    expect(await screen.findByRole('columnheader', { name: 'Player' })).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    // Bam Adebayo links to his real ESPN id.
    const bam = await screen.findByRole('link', { name: /Bam Adebayo/ })
    expect(BAM.id).toBe('4066261')
    expect(bam).toHaveAttribute('href', '/player/4066261')

    // Tap sound on the roster player link, exactly as in base (fb7b2d1).
    sound.playGlassClick.mockClear()
    fireEvent.click(bam)
    expect(sound.playGlassClick).toHaveBeenCalledTimes(1)
  })

  it('shows PageState on a fetch error, with a working retry', async () => {
    fetchTeamDetail.mockRejectedValueOnce(new Error('team not found'))
    fetchStandings.mockResolvedValue(REAL_STANDINGS)

    renderTeamDetail('MIA')

    await screen.findByText("Couldn't load this team.")
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('D12: Stats tab is built from the standings row already loaded for the team', async () => {
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

    // Real seed 10 -> Play-in, in the hero and in the Stats tab's seed line.
    expect(screen.getAllByText('Play-in').length).toBeGreaterThanOrEqual(1)
  })

  it('D12: Stats tab shows PageState empty when standings could not be loaded', async () => {
    fetchTeamDetail.mockResolvedValue(REAL_MIA)
    fetchStandings.mockRejectedValue(new Error('network down'))
    fetchTeamRoster.mockResolvedValue(REAL_MIA_ROSTER)
    fetchTeamSchedule.mockResolvedValue([])

    renderTeamDetail('MIA')
    await screen.findByText('Miami Heat')

    await userEvent.click(screen.getByRole('tab', { name: 'Stats' }))

    expect(await screen.findByText("Stats aren't available for this team yet.")).toBeInTheDocument()
  })

  it('D9: restores conference rank, roster headshots with an initial fallback, and roster size', async () => {
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

  it('D9: the GB "Leader" wording for the real conference leader (DET, gb "-")', async () => {
    expect(row('DET').gb).toBe('-')
    mockTeam(REAL_DET.data, REAL_DET_ROSTER.data)
    renderTeamDetail('DET')
    await screen.findByText('Detroit Pistons')
    await userEvent.click(screen.getByRole('tab', { name: 'Stats' }))
    expect(await screen.findByText('Leader')).toBeInTheDocument()
    expect(screen.getAllByText('East #1').length).toBeGreaterThanOrEqual(1)
  })

  it('D9: a team seeded 11+ gets no seed badge but still shows its conference rank (real CHI, seed 12)', async () => {
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
