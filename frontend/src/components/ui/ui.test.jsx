import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Card, Badge, Stat, Segmented, DataTable, TeamMark, PageState, SectionHeader } from './index'

describe('ui', () => {
  it('Card uses surface-1, border and 16px radius; live adds glow class', () => {
    const { container, rerender } = render(<Card>x</Card>)
    expect(container.firstChild).toHaveClass('bg-surface-1', 'border-border', 'rounded-lg')
    rerender(<Card live>x</Card>)
    expect(container.firstChild).toHaveClass('card-live')
  })
  it('Badge variants map to token colors only', () => {
    render(<><Badge variant="live">Live</Badge><Badge variant="loss">L</Badge><Badge variant="warn">Play-in</Badge></>)
    expect(screen.getByText('Live')).toHaveClass('text-live')
    expect(screen.getByText('L')).toHaveClass('text-loss')
    expect(screen.getByText('Play-in')).toHaveClass('text-warn')
  })
  it('Badge drops legacy DOM props and renders a dot indicator', () => {
    const onRemove = vi.fn()
    render(
      <Badge variant="success" dot size="sm" removable onRemove={onRemove}>
        Q2
      </Badge>
    )
    const badge = screen.getByText('Q2')
    expect(badge).not.toHaveAttribute('dot')
    expect(badge).not.toHaveAttribute('size')
    expect(badge).not.toHaveAttribute('removable')
    const indicator = badge.querySelector('[aria-hidden]')
    expect(indicator).toHaveClass('rounded-full', 'bg-current')
    expect(onRemove).not.toHaveBeenCalled()
  })
  it('Stat renders tabular value and delta with an sr-only direction and a hidden glyph', () => {
    const { rerender } = render(<Stat label="PTS" value="32.7" delta={1.2} />)
    expect(screen.getByText('32.7')).toHaveClass('tnum')
    const upGlyph = screen.getByText(/▲/)
    expect(upGlyph).toBeInTheDocument()
    expect(upGlyph).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('up 1.2')).toHaveClass('sr-only')

    rerender(<Stat label="PTS" value="30.1" delta={-0.8} />)
    const downGlyph = screen.getByText(/▼/)
    expect(downGlyph).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('down 0.8')).toHaveClass('sr-only')
  })
  it('Segmented calls onChange and marks the active option', async () => {
    const onChange = vi.fn()
    render(<Segmented options={[{ id: 'all', label: 'All' }, { id: 'live', label: 'Live' }]} value="all" onChange={onChange} />)
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('tab', { name: 'Live' }))
    expect(onChange).toHaveBeenCalledWith('live')
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
    render(<DataTable columns={[{ key: 'team', label: 'Team' }, { key: 'w', label: 'W', numeric: true }]} rows={[{ team: 'DET', w: 60 }]} getKey={(r) => r.team} />)
    expect(screen.getByRole('columnheader', { name: 'W' })).toBeInTheDocument()
    expect(screen.getByText('60')).toHaveClass('tnum')
  })
  it('DataTable is unsorted by default: no button, no aria-sort, when sortable is absent', () => {
    render(<DataTable columns={[{ key: 'w', label: 'W', numeric: true }]} rows={[{ w: 60 }]} getKey={(r) => r.w} />)
    const header = screen.getByRole('columnheader', { name: 'W' })
    expect(header).not.toHaveAttribute('aria-sort')
    expect(screen.queryByRole('button', { name: 'W' })).not.toBeInTheDocument()
  })
  it('DataTable sortable columns render a button with aria-sort and report clicks via onSortChange', async () => {
    const onSortChange = vi.fn()
    const columns = [
      { key: 'team', label: 'Team', sortable: true },
      { key: 'w', label: 'W', numeric: true, sortable: true },
    ]
    const rows = [{ team: 'DET', w: 60 }, { team: 'BOS', w: 56 }]
    const { rerender } = render(
      <DataTable columns={columns} rows={rows} getKey={(r) => r.team} sort={{ key: 'w', dir: 'desc' }} onSortChange={onSortChange} />
    )
    const wHeader = screen.getByRole('columnheader', { name: 'W' })
    expect(wHeader).toHaveAttribute('aria-sort', 'descending')
    const wGlyph = screen.getByText('▼')
    expect(wGlyph).toHaveAttribute('aria-hidden', 'true')

    const teamHeader = screen.getByRole('columnheader', { name: 'Team' })
    expect(teamHeader).toHaveAttribute('aria-sort', 'none')

    await userEvent.click(screen.getByRole('button', { name: 'Team' }))
    expect(onSortChange).toHaveBeenCalledWith('team')

    rerender(
      <DataTable columns={columns} rows={rows} getKey={(r) => r.team} sort={{ key: 'w', dir: 'asc' }} onSortChange={onSortChange} />
    )
    expect(screen.getByText('▲')).toHaveAttribute('aria-hidden', 'true')
  })
  it('TeamMark shows abbreviation and logo alt', () => {
    render(<TeamMark abbrev="MIA" logoUrl="https://x/mia.png" />)
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
})
