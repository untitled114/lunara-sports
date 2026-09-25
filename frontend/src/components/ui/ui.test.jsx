import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Card, Badge, Stat, Segmented, DataTable, TeamMark, PageState, SectionHeader } from './index'
import Tabs from './Tabs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// Real captures only (e2e/fixtures/README.md, src/test/fixtures/*._source): no values
// typed in by hand.
import REAL_STANDINGS from '../../../e2e/fixtures/api/standings.json'
import REAL_MIA from '../../../e2e/fixtures/api/teams_MIA.json'
import REAL_MIA_ROSTER from '../../../e2e/fixtures/api/teams_MIA_roster.json'
import statsLeaders from '@/test/fixtures/statsLeaders.json'

const [PTS1, PTS2] = statsLeaders.data.categories.pts
// The real gap between the top two scorers, as a Stat delta.
const GAP = Number((Number(PTS1.value) - Number(PTS2.value)).toFixed(1))
const [DET, BOS] = REAL_STANDINGS.eastern
const BAM = REAL_MIA_ROSTER.find((p) => p.name === 'Bam Adebayo')

describe('ui', () => {
  it('Card uses surface-1, border and 16px radius; live adds glow class', () => {
    const { container, rerender } = render(<Card>x</Card>)
    expect(container.firstChild).toHaveClass('bg-surface-card', 'border-border', 'rounded-lg')
    rerender(<Card live>x</Card>)
    expect(container.firstChild).toHaveClass('card-live')
  })
  it('Badge variants map to token colors only', () => {
    render(<><Badge variant="live">Live</Badge><Badge variant="loss">L</Badge><Badge variant="warn">Play-in</Badge></>)
    expect(screen.getByText('Live')).toHaveClass('text-live')
    expect(screen.getByText('L')).toHaveClass('text-loss')
    expect(screen.getByText('Play-in')).toHaveClass('text-warn')
  })
  it('Badge renders a round dot indicator and passes other props through', () => {
    render(
      <Badge variant="win" dot title="Won">
        Q2
      </Badge>
    )
    const badge = screen.getByText('Q2')
    expect(badge).toHaveClass('text-live', 'rounded-sm')
    expect(badge).toHaveAttribute('title', 'Won')
    expect(badge).not.toHaveAttribute('dot')
    const indicator = badge.querySelector('[aria-hidden]')
    expect(indicator).toHaveClass('h-1.5', 'w-1.5', 'rounded-sm', 'bg-current')
  })
  it('Badge falls back to neutral for an unknown variant', () => {
    render(<Badge variant="primary">Old</Badge>)
    expect(screen.getByText('Old')).toHaveClass('text-text-2', 'bg-surface-2')
  })
  it('Badge pulse adds a ping to the dot, and the plain dot stays still', () => {
    render(<><Badge variant="live" dot pulse>Live</Badge><Badge variant="live" dot>Still</Badge></>)
    expect(screen.getByText('Live').querySelector('.animate-ping')).not.toBeNull()
    expect(screen.getByText('Still').querySelector('.animate-ping')).toBeNull()
  })
  it('Stat renders tabular value and delta with an sr-only direction and a hidden glyph', () => {
    expect(GAP).toBeGreaterThan(0)
    const { rerender } = render(<Stat label="PTS" value={PTS1.value} delta={GAP} />)
    expect(screen.getByText(PTS1.value)).toHaveClass('tnum')
    const upGlyph = screen.getByText(/▲/)
    expect(upGlyph).toBeInTheDocument()
    expect(upGlyph).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText(`up ${GAP}`)).toHaveClass('sr-only')

    rerender(<Stat label="PTS" value={PTS2.value} delta={-GAP} />)
    const downGlyph = screen.getByText(/▼/)
    expect(downGlyph).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText(`down ${GAP}`)).toHaveClass('sr-only')
  })
  it('Segmented calls onChange and marks the active option', async () => {
    const onChange = vi.fn()
    render(<Segmented options={[{ id: 'all', label: 'All' }, { id: 'live', label: 'Live' }]} value="all" onChange={onChange} />)
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
    // One selected look site-wide: the accent fill, as on the top nav and date strip.
    expect(screen.getByRole('tab', { name: 'All' })).toHaveClass('bg-accent-fill', 'text-white')
    expect(screen.getByRole('tab', { name: 'Live' })).not.toHaveClass('bg-accent-fill')
    await userEvent.click(screen.getByRole('tab', { name: 'Live' }))
    expect(onChange).toHaveBeenCalledWith('live')
  })
  it('Segmented names its tablist when given an aria-label', () => {
    render(<Segmented aria-label="Filter games" options={[{ id: 'all', label: 'All' }]} value="all" onChange={() => {}} />)
    expect(screen.getByRole('tablist', { name: 'Filter games' })).toBeInTheDocument()
  })
  it('Segmented uses roving tabindex and moves focus + selection with arrow keys', async () => {
    const onChange = vi.fn()
    const options = [
      { id: 'all', label: 'All' },
      { id: 'live', label: 'Live' },
      { id: 'final', label: 'Final' },
    ]
    render(<Segmented options={options} value="all" onChange={onChange} />)
    const all = screen.getByRole('tab', { name: 'All' })
    const live = screen.getByRole('tab', { name: 'Live' })
    const final = screen.getByRole('tab', { name: 'Final' })

    expect(all).toHaveAttribute('tabIndex', '0')
    expect(live).toHaveAttribute('tabIndex', '-1')
    expect(final).toHaveAttribute('tabIndex', '-1')

    all.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('live')
    expect(live).toHaveFocus()

    await userEvent.keyboard('{End}')
    expect(onChange).toHaveBeenLastCalledWith('final')
    expect(final).toHaveFocus()

    await userEvent.keyboard('{Home}')
    expect(onChange).toHaveBeenLastCalledWith('all')
    expect(all).toHaveFocus()

    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('final')
    expect(final).toHaveFocus()
  })
  it('DataTable renders headers and tabular numeric cells', () => {
    render(<DataTable columns={[{ key: 'abbrev', label: 'Team' }, { key: 'w', label: 'W', numeric: true }]} rows={[DET]} getKey={(r) => r.abbrev} />)
    expect(screen.getByRole('columnheader', { name: 'W' })).toBeInTheDocument()
    expect(screen.getByText(String(DET.w))).toHaveClass('tnum')
  })
  it('DataTable is unsorted by default: no button, no aria-sort, when sortable is absent', () => {
    render(<DataTable columns={[{ key: 'w', label: 'W', numeric: true }]} rows={[DET]} getKey={(r) => r.abbrev} />)
    const header = screen.getByRole('columnheader', { name: 'W' })
    expect(header).not.toHaveAttribute('aria-sort')
    expect(screen.queryByRole('button', { name: 'W' })).not.toBeInTheDocument()
  })
  it('DataTable sortable columns render a button with aria-sort and report clicks via onSortChange', async () => {
    const onSortChange = vi.fn()
    const columns = [
      { key: 'abbrev', label: 'Team', sortable: true },
      { key: 'w', label: 'W', numeric: true, sortable: true },
    ]
    const rows = [DET, BOS]
    const { rerender } = render(
      <DataTable columns={columns} rows={rows} getKey={(r) => r.abbrev} sort={{ key: 'w', dir: 'desc' }} onSortChange={onSortChange} />
    )
    const wHeader = screen.getByRole('columnheader', { name: 'W' })
    expect(wHeader).toHaveAttribute('aria-sort', 'descending')
    const wGlyph = screen.getByText('▼')
    expect(wGlyph).toHaveAttribute('aria-hidden', 'true')

    const teamHeader = screen.getByRole('columnheader', { name: 'Team' })
    expect(teamHeader).toHaveAttribute('aria-sort', 'none')

    await userEvent.click(screen.getByRole('button', { name: 'Team' }))
    expect(onSortChange).toHaveBeenCalledWith('abbrev')

    rerender(
      <DataTable columns={columns} rows={rows} getKey={(r) => r.abbrev} sort={{ key: 'w', dir: 'asc' }} onSortChange={onSortChange} />
    )
    expect(screen.getByText('▲')).toHaveAttribute('aria-hidden', 'true')
  })
  it('TeamMark shows abbreviation and logo alt', () => {
    render(<TeamMark abbrev={REAL_MIA.abbrev} logoUrl={REAL_MIA.logo_url} />)
    expect(screen.getByText('MIA')).toBeInTheDocument()
    expect(screen.getByAltText('MIA logo')).toBeInTheDocument()
  })
  it('PageState error shows plain copy and retries', async () => {
    const onRetry = vi.fn()
    render(<PageState kind="error" title="Couldn't load standings." onRetry={onRetry} />)
    expect(screen.getByText("Couldn't load standings.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalled()
  })
  it('PageState "Try again" uses the accent-fill token, not the text/link accent', () => {
    render(<PageState kind="error" title="Couldn't load this." onRetry={() => {}} />)
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveClass(
      'bg-accent-fill',
      'hover:bg-accent-fill-hover',
      'text-white'
    )
  })
  it('PageState loading and empty', () => {
    const { rerender } = render(<PageState kind="loading" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    rerender(<PageState kind="empty" title="No games today." action={<a href="/x">Next game</a>} />)
    expect(screen.getByText('No games today.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Next game' })).toBeInTheDocument()
  })
  it('SectionHeader title + aside', () => {
    render(<SectionHeader title="Standings" aside="2025–26 final" />)
    expect(screen.getByRole('heading', { name: 'Standings' })).toHaveClass('t-section')
    expect(screen.getByText('2025–26 final')).toHaveClass('t-label')
  })

  it('Segmented and Tabs share one overflow rule: never wider than the container, scroll with no scrollbar', () => {
    const { container, unmount } = render(
      <Segmented options={[{ id: 'a', label: 'All' }, { id: 'g', label: 'Goldmine' }]} value="a" onChange={() => {}} />
    )
    const seg = container.querySelector('[role=tablist]')
    expect(seg).toHaveClass('max-w-full', 'overflow-x-auto', 'scrollbar-hide')
    for (const tab of seg.querySelectorAll('[role=tab]')) expect(tab).toHaveClass('shrink-0', 'whitespace-nowrap')
    unmount()

    render(<Tabs tabs={[{ id: 'o', label: 'Overview' }, { id: 'l', label: 'Game log' }]} activeTab="o" />)
    const list = screen.getByRole('tablist')
    expect(list).toHaveClass('max-w-full', 'overflow-x-auto', 'scrollbar-hide')
    expect(list).not.toHaveClass('scrollbar-thin')
    for (const tab of screen.getAllByRole('tab')) expect(tab).toHaveClass('shrink-0')
  })

  it('DataTable keeps numeric cells and nowrap text cells on one line', () => {
    render(
      <DataTable
        columns={[
          { key: 'name', label: 'Player' },
          { key: 'height', label: 'Ht', nowrap: true },
          { key: 'weight', label: 'Wt', numeric: true },
        ]}
        rows={[BAM]}
        getKey={(r) => r.id}
      />
    )
    expect(screen.getByText(BAM.height)).toHaveClass('whitespace-nowrap')
    expect(screen.getByText(BAM.height)).not.toHaveClass('tnum')
    expect(screen.getByText(BAM.weight)).toHaveClass('whitespace-nowrap', 'tnum')
    expect(screen.getByText(BAM.name)).not.toHaveClass('whitespace-nowrap')
  })

  it('SectionHeader right-aligns a caption that wraps', () => {
    render(<SectionHeader title="Defense" aside="Rim protection and perimeter defense" />)
    expect(screen.getByText('Rim protection and perimeter defense')).toHaveClass('text-right')
  })

  it('headings never break mid-word: no word-break rule that lowers their min-content width', () => {
    const css = readFileSync(join(__dirname, '..', '..', 'styles.css'), 'utf8')
    expect(css).not.toMatch(/word-break:\s*break-(word|all)/)
    expect(css).not.toMatch(/overflow-wrap:\s*anywhere/)
  })
})
