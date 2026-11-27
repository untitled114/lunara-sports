import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PlayerLink } from './PlayerLink'
import { TeamLink } from './TeamLink'
import { hasStarted } from '@/lib/gameMath'

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('PlayerLink and TeamLink', () => {
  it('PlayerLink is one link to /player/<id> around everything it is given', () => {
    // Bam Adebayo, ESPN id 4066261 (e2e/fixtures/api/players_4066261.json).
    const { container } = wrap(
      <PlayerLink id="4066261" className="row">
        <img alt="" src="https://a.espncdn.com/i/headshots/nba/players/full/4066261.png" />
        <span>Bam Adebayo</span>
      </PlayerLink>
    )
    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/player/4066261')
    expect(links[0].querySelector('img')).not.toBeNull()
    expect(links[0]).toHaveClass('row')
  })

  it('TeamLink is one link to /team/<abbrev> around the logo and name', () => {
    const { container } = wrap(
      <TeamLink abbrev="DET">
        <img alt="" src="https://a.espncdn.com/i/teamlogos/nba/500/det.png" />
        <span>Detroit Pistons</span>
      </TeamLink>
    )
    expect(screen.getByRole('link')).toHaveAttribute('href', '/team/DET')
    expect(container.querySelectorAll('a')).toHaveLength(1)
  })

  it('without an id, PlayerLink renders its content as plain text, not a dead link', () => {
    const { container } = wrap(<PlayerLink id={null}>Unknown player</PlayerLink>)
    expect(container.querySelector('a')).toBeNull()
    expect(screen.getByText('Unknown player')).toBeInTheDocument()
  })
})

describe('hasStarted', () => {
  it('live, halftime and final have started; scheduled and unknown have not', () => {
    for (const s of ['live', 'halftime', 'final']) expect(hasStarted(s)).toBe(true)
    for (const s of ['scheduled', '', undefined, 'postponed']) expect(hasStarted(s)).toBe(false)
  })
})
