import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Discovery } from '../src/screens/Discovery.js'
import { api } from '../src/api.js'
import { t } from '../src/i18n.js'

vi.mock('../src/api.js', () => ({
  api: {
    auth: { verify: vi.fn() },
    profile: { get: vi.fn(), update: vi.fn() },
    photos: { getUploadUrl: vi.fn(), delete: vi.fn(), reorder: vi.fn(), uploadFile: vi.fn() },
    discovery: { feed: vi.fn() },
    swipes: { swipe: vi.fn() },
    matches: { list: vi.fn() },
    directChat: { start: vi.fn() },
  },
}))

const MOCK_PROFILES = [
  { id: 'p1', name: 'Sara', age: 24, bio: 'Hello', telegramId: 99, photos: ['https://img1'], interests: [], location: null },
  { id: 'p2', name: 'Mona', age: 26, bio: null,    telegramId: 88, photos: [],               interests: [], location: null },
]

describe('Discovery', () => {
  it('renders first profile name', async () => {
    vi.mocked(api.discovery.feed).mockResolvedValue({ profiles: MOCK_PROFILES, exhausted: false })
    vi.mocked(api.swipes.swipe).mockResolvedValue({ matched: false })

    render(<Discovery onOpenChat={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Sara')).toBeInTheDocument()
    })
  })

  it('shows exhausted state when pool is empty', async () => {
    vi.mocked(api.discovery.feed).mockResolvedValue({ profiles: [], exhausted: true })

    render(<Discovery onOpenChat={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/You've seen everyone/)).toBeInTheDocument()
    })
  })

  it('calls swipe like when Like button is clicked', async () => {
    vi.mocked(api.discovery.feed).mockResolvedValue({ profiles: MOCK_PROFILES, exhausted: false })
    vi.mocked(api.swipes.swipe).mockResolvedValue({ matched: false })

    render(<Discovery onOpenChat={vi.fn()} />)

    await waitFor(() => screen.getByText('Sara'))

    screen.getByRole('button', { name: /Like/ }).click()

    await waitFor(() => {
      expect(api.swipes.swipe).toHaveBeenCalledWith('p1', 'like')
    })
  })

  it('renders the direct-chat button on the card [direct-chat]', async () => {
    vi.mocked(api.discovery.feed).mockResolvedValue({ profiles: MOCK_PROFILES, exhausted: false })
    render(<Discovery onOpenChat={vi.fn()} />)
    await waitFor(() => screen.getByText('Sara'))
    expect(screen.getByRole('button', { name: t.aria.directChat })).toBeInTheDocument()
  })
})
