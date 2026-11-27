import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import * as api from '@/services/api'
import LeadersPage from './LeadersPage'
// Real GET /stats/leaders?limit=25 response (see fixture _source).
import leaders25 from '@/test/fixtures/statsLeaders25.json'

vi.mock('@/services/api', async (orig) => ({ ...(await orig()), fetchStatLeaders: vi.fn() }))

const open = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/stats/leaders/:category" element={<LeadersPage />} />
      </Routes>
    </MemoryRouter>
  )

describe('LeadersPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('lists the top 25 of the category in the URL, in rank order', async () => {
    api.fetchStatLeaders.mockResolvedValue(leaders25.data)
    open('/stats/leaders/reb')
    const rows = leaders25.data.categories.reb
    expect(rows).toHaveLength(25)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Rebounds' })).toBeInTheDocument())
    expect(api.fetchStatLeaders).toHaveBeenCalledWith(25)
    const table = screen.getByRole('table')
    const bodyRows = within(table).getAllByRole('row').slice(1)
    expect(bodyRows).toHaveLength(25)
    expect(within(bodyRows[0]).getByText(rows[0].player)).toBeInTheDocument()
    expect(within(bodyRows[24]).getByText(rows[24].player)).toBeInTheDocument()
    expect(screen.getByText(leaders25.data.season_label)).toBeInTheDocument()
  })

  it('switches category from the selector', async () => {
    api.fetchStatLeaders.mockResolvedValue(leaders25.data)
    open('/stats/leaders/pts')
    await screen.findByRole('heading', { name: 'Points' })
    await userEvent.click(screen.getByRole('tab', { name: 'Free throw %' }))
    expect(await screen.findByRole('heading', { name: 'Free throw %' })).toBeInTheDocument()
    expect(screen.getAllByText(leaders25.data.categories.ft_pct[0].player).length).toBeGreaterThan(0)
  })

  it('an unknown category shows points', async () => {
    api.fetchStatLeaders.mockResolvedValue(leaders25.data)
    open('/stats/leaders/nope')
    expect(await screen.findByRole('heading', { name: 'Points' })).toBeInTheDocument()
  })

  it('a failed load offers a retry', async () => {
    api.fetchStatLeaders.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(leaders25.data)
    open('/stats/leaders/pts')
    await userEvent.click(await screen.findByRole('button', { name: /try again|retry/i }))
    expect(await screen.findByRole('heading', { name: 'Points' })).toBeInTheDocument()
  })
})
