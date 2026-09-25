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
  it('Stat renders tabular value and delta', () => {
    render(<Stat label="PTS" value="32.7" delta={1.2} />)
    expect(screen.getByText('32.7')).toHaveClass('tnum')
    expect(screen.getByText(/▲/)).toBeInTheDocument()
  })
  it('Segmented calls onChange and marks the active option', async () => {
    const onChange = vi.fn()
    render(<Segmented options={[{ id: 'all', label: 'All' }, { id: 'live', label: 'Live' }]} value="all" onChange={onChange} />)
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('tab', { name: 'Live' }))
    expect(onChange).toHaveBeenCalledWith('live')
  })
  it('DataTable renders headers and tabular numeric cells', () => {
    render(<DataTable columns={[{ key: 'team', label: 'Team' }, { key: 'w', label: 'W', numeric: true }]} rows={[{ team: 'DET', w: 60 }]} getKey={(r) => r.team} />)
    expect(screen.getByRole('columnheader', { name: 'W' })).toBeInTheDocument()
    expect(screen.getByText('60')).toHaveClass('tnum')
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
