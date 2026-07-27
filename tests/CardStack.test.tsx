import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Discovery } from '../src/screens/Discovery.js'
import { api } from '../src/api.js'

vi.mock('../src/api.js', () => ({
  api: {
    auth: { verify: vi.fn() },
    profile: { get: vi.fn(), update: vi.fn() },
    photos: { getUploadUrl: vi.fn(), delete: vi.fn(), reorder: vi.fn(), uploadFile: vi.fn() },
    discovery: { feed: vi.fn() },
    swipes: { swipe: vi.fn() },
    matches: { list: vi.fn() },
  },
}))

const MOCK_PROFILES = [
  { id: 'p1', name: 'Sara', age: 24, bio: 'سلام', telegramId: 99, photos: ['https://img1'] },
  { id: 'p2', name: 'Mona', age: 26, bio: null, telegramId: 88, photos: [] },
]

describe('Discovery', () => {
  it('renders first profile name', async () => {
    vi.mocked(api.discovery.feed).mockResolvedValue({ profiles: MOCK_PROFILES, exhausted: false })
    vi.mocked(api.swipes.swipe).mockResolvedValue({ matched: false })

    render(<Discovery />)

    await waitFor(() => {
      expect(screen.getByText('Sara')).toBeInTheDocument()
    })
  })

  it('shows exhausted state when pool is empty', async () => {
    vi.mocked(api.discovery.feed).mockResolvedValue({ profiles: [], exhausted: true })

    render(<Discovery />)

    await waitFor(() => {
      expect(screen.getByText(/فعلاً کسی نیست/)).toBeInTheDocument()
    })
  })

  it('calls swipe like and advances to next card', async () => {
    vi.mocked(api.discovery.feed).mockResolvedValue({ profiles: MOCK_PROFILES, exhausted: false })
    vi.mocked(api.swipes.swipe).mockResolvedValue({ matched: false })

    render(<Discovery />)

    await waitFor(() => screen.getByText('Sara'))

    fireEvent.click(screen.getByRole('button', { name: /پسندیدم/ }))

    await waitFor(() => {
      expect(api.swipes.swipe).toHaveBeenCalledWith('p1', 'like')
    })
  })
})
