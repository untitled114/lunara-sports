import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlayerHeadshot } from './PlayerHeadshot'
import { getHeadshotUrl } from '@/utils/teamColors'
// Real GET /players/4066261 capture (Bam Adebayo); its headshot_url is ESPN's full-size PNG.
import REAL_PLAYER from '../../../e2e/fixtures/api/players_4066261.json'

const FULL = REAL_PLAYER.headshot_url

describe('getHeadshotUrl', () => {
  it('asks ESPN for a small square through the combiner, never the full-size file', () => {
    expect(FULL).toBe('https://a.espncdn.com/i/headshots/nba/players/full/4066261.png')
    expect(getHeadshotUrl(FULL, 88)).toBe(
      'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/4066261.png&w=88&h=88'
    )
    expect(getHeadshotUrl(FULL)).toMatch(/&w=96&h=96$/)
    expect(getHeadshotUrl(null)).toBeNull()
  })

  it('leaves a URL that is already a combiner URL unchanged', () => {
    const small = getHeadshotUrl(FULL, 96)
    expect(getHeadshotUrl(small, 48)).toBe(small)
  })
})

describe('PlayerHeadshot', () => {
  it('renders at px and requests 2x through the combiner', () => {
    render(<PlayerHeadshot url={FULL} px={44} alt={REAL_PLAYER.name} />)
    const img = screen.getByAltText('Bam Adebayo')
    expect(img).toHaveAttribute('src', getHeadshotUrl(FULL, 88))
    expect(img).toHaveAttribute('width', '44')
    expect(img).toHaveAttribute('height', '44')
  })

  it('shows the fallback when there is no headshot', () => {
    render(<PlayerHeadshot url={null} px={44} fallback={<span>B</span>} />)
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('swaps to the fallback when ESPN answers with an error', () => {
    render(<PlayerHeadshot url={FULL} px={48} alt="Bam Adebayo" fallback={<span>B</span>} />)
    fireEvent.error(screen.getByAltText('Bam Adebayo'))
    expect(screen.queryByAltText('Bam Adebayo')).toBeNull()
    expect(screen.getByText('B')).toBeInTheDocument()
  })
})
