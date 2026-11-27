import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Segmented } from './Segmented'

const OPTIONS = [
  { id: 'ET', label: 'ET' },
  { id: 'PT', label: 'PT' },
]

describe('Segmented', () => {
  it('each option is at least 44px tall on a phone and keeps its size from sm up', () => {
    render(<Segmented aria-label="Time zone" options={OPTIONS} value="ET" onChange={vi.fn()} />)
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveClass('min-h-[44px]', 'sm:min-h-0')
    }
  })
})
