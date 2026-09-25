import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Calendar, ListOrdered, BarChart3 } from 'lucide-react'
import { BottomNav } from './BottomNav'

// The top menu (AppLayout NAV_LINKS) uses Calendar / ListOrdered / BarChart3 for these.
const iconClass = (Icon) => render(<Icon />).container.querySelector('svg').getAttribute('class')

describe('BottomNav', () => {
  it('uses the same icon per destination as the top menu', () => {
    const expected = {
      Scoreboard: iconClass(Calendar),
      Standings: iconClass(ListOrdered),
      Stats: iconClass(BarChart3),
    }
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    for (const [label, cls] of Object.entries(expected)) {
      const svg = screen.getByRole('link', { name: label }).querySelector('svg')
      expect(svg.getAttribute('class')).toContain(cls.split(' ')[1])
    }
  })
})
