import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ playGlassClick: vi.fn(), playThud: vi.fn() }),
}))
vi.mock('@/services/api', () => ({ fetchPlayers: vi.fn(() => Promise.resolve([])) }))

import { CommandBar } from './CommandBar'
import { ReactionOverlay } from '@/components/sport/ReactionOverlay'

describe('icon-only buttons have accessible names', () => {
  it('CommandBar: the close X is "Close search"', () => {
    render(
      <MemoryRouter>
        <CommandBar />
      </MemoryRouter>
    )
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByRole('button', { name: 'Close search' })).toBeInTheDocument()
  })

  it('ReactionOverlay: each emoji button is named, not read as the raw emoji', () => {
    render(<ReactionOverlay />)
    for (const name of ['Fire', 'Shocked', 'Brick', 'Bullseye', 'Raised hands', 'Ice cold']) {
      expect(screen.getByRole('button', { name: `React: ${name}` })).toBeInTheDocument()
    }
  })
})
