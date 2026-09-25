import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Home, BarChart2 } from 'lucide-react'
import Tabs from './Tabs'

describe('Tabs', () => {
  it('renders the shared Segmented look regardless of variant', () => {
    const { container } = render(
      <Tabs
        variant="underline"
        activeTab="overview"
        onChange={() => {}}
        tabs={[
          { id: 'overview', label: 'Overview', icon: Home },
          { id: 'stats', label: 'Stats', icon: BarChart2 },
        ]}
      />
    )
    const tablist = screen.getByRole('tablist')
    expect(tablist).toHaveClass('bg-surface-1', 'border-border', 'rounded-md')
    const active = screen.getByRole('tab', { name: 'Overview' })
    const inactive = screen.getByRole('tab', { name: 'Stats' })
    expect(active).toHaveClass('bg-accent-fill', 'text-white')
    expect(inactive).toHaveClass('text-text-2')
    // icons still render
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2)
  })

  it('calls onChange and marks the active tab', async () => {
    const onChange = vi.fn()
    render(
      <Tabs
        activeTab="overview"
        onChange={onChange}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'stats', label: 'Stats' },
        ]}
      />
    )
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('tab', { name: 'Stats' }))
    expect(onChange).toHaveBeenCalledWith('stats')
  })

  it('uses roving tabindex and moves focus + selection with arrow keys, skipping disabled tabs', async () => {
    const onChange = vi.fn()
    const tabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'stats', label: 'Stats', disabled: true },
      { id: 'log', label: 'Log' },
    ]
    render(<Tabs activeTab="overview" onChange={onChange} tabs={tabs} />)
    const overview = screen.getByRole('tab', { name: 'Overview' })
    const stats = screen.getByRole('tab', { name: 'Stats' })
    const log = screen.getByRole('tab', { name: 'Log' })

    expect(overview).toHaveAttribute('tabIndex', '0')
    expect(stats).toHaveAttribute('tabIndex', '-1')
    expect(log).toHaveAttribute('tabIndex', '-1')

    overview.focus()
    await userEvent.keyboard('{ArrowRight}')
    // Stats is disabled: ArrowRight from Overview skips straight over it to Log,
    // matching the base (pre-rollout) Tabs component's disabled-skip behavior.
    expect(onChange).not.toHaveBeenCalledWith('stats')
    expect(onChange).toHaveBeenLastCalledWith('log')
    expect(log).toHaveFocus()

    await userEvent.keyboard('{ArrowLeft}')
    // ArrowLeft from Log skips backward over Stats to Overview.
    expect(onChange).not.toHaveBeenCalledWith('stats')
    expect(onChange).toHaveBeenLastCalledWith('overview')
    expect(overview).toHaveFocus()

    await userEvent.keyboard('{End}')
    expect(onChange).toHaveBeenLastCalledWith('log')
    expect(log).toHaveFocus()

    await userEvent.keyboard('{Home}')
    expect(onChange).toHaveBeenLastCalledWith('overview')
    expect(overview).toHaveFocus()
  })
})
