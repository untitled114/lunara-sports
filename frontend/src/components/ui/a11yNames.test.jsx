import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ playGlassClick: vi.fn(), playThud: vi.fn() }),
}))
vi.mock('@/services/api', () => ({ fetchPlayers: vi.fn(() => Promise.resolve([])) }))

import { CommandBar } from './CommandBar'

describe('icon-only buttons have accessible names', () => {
  it('CommandBar: the close X is "Close search" and asks the layout to close', () => {
    const onOpenChange = vi.fn()
    render(
      <MemoryRouter>
        <CommandBar open onOpenChange={onOpenChange} />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
