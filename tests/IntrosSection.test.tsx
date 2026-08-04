import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IntrosSection } from '../src/components/gifts/IntrosSection.js'
import { api } from '../src/api.js'

const BASE_INTRO = {
  id: 'intro-1',
  buyer: { id: 'buyer-1', name: 'Sara', photo: null },
  emoji: '🌹',
  note: 'Hope you like it!',
  createdAt: '2026-01-01T00:00:00Z',
}

describe('IntrosSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when there are no pending intros', async () => {
    vi.mocked(api.gifts.intros).mockResolvedValue({ intros: [] })
    const { container } = render(<IntrosSection onOpenChat={vi.fn()} refreshKey={0} />)
    await waitFor(() => expect(api.gifts.intros).toHaveBeenCalledTimes(1))
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a card for each pending intro', async () => {
    vi.mocked(api.gifts.intros).mockResolvedValue({ intros: [BASE_INTRO] })
    render(<IntrosSection onOpenChat={vi.fn()} refreshKey={0} />)
    await waitFor(() => screen.getByText('Sara'))
    expect(screen.getByText('Hope you like it!')).toBeInTheDocument()
    expect(screen.getByText('🌹')).toBeInTheDocument()
  })

  it('accepts an intro, opens the chat for the returned matchId, and removes the card', async () => {
    vi.mocked(api.gifts.intros).mockResolvedValue({ intros: [BASE_INTRO] })
    vi.mocked(api.gifts.acceptIntro).mockResolvedValue({ matchId: 'match-99' })
    const onOpenChat = vi.fn()
    render(<IntrosSection onOpenChat={onOpenChat} refreshKey={0} />)
    await waitFor(() => screen.getByText('Sara'))

    fireEvent.click(screen.getByText('Accept'))

    await waitFor(() => expect(api.gifts.acceptIntro).toHaveBeenCalledWith('intro-1'))
    await waitFor(() => expect(onOpenChat).toHaveBeenCalledWith('match-99'))
    await waitFor(() => expect(screen.queryByText('Sara')).not.toBeInTheDocument())
  })

  it('dismisses an intro and removes the card', async () => {
    vi.mocked(api.gifts.intros).mockResolvedValue({ intros: [BASE_INTRO] })
    vi.mocked(api.gifts.dismissIntro).mockResolvedValue({ ok: true })
    render(<IntrosSection onOpenChat={vi.fn()} refreshKey={0} />)
    await waitFor(() => screen.getByText('Sara'))

    fireEvent.click(screen.getByText('Dismiss'))

    await waitFor(() => expect(api.gifts.dismissIntro).toHaveBeenCalledWith('intro-1'))
    await waitFor(() => expect(screen.queryByText('Sara')).not.toBeInTheDocument())
  })

  it('shows an inline error and keeps the card when accept fails', async () => {
    vi.mocked(api.gifts.intros).mockResolvedValue({ intros: [BASE_INTRO] })
    vi.mocked(api.gifts.acceptIntro).mockRejectedValue(new Error('nope'))
    render(<IntrosSection onOpenChat={vi.fn()} refreshKey={0} />)
    await waitFor(() => screen.getByText('Sara'))

    fireEvent.click(screen.getByText('Accept'))

    await waitFor(() => screen.getByText('Could not accept the gift. Please try again.'))
    expect(screen.getByText('Sara')).toBeInTheDocument()
  })

  it('refetches intros when refreshKey changes', async () => {
    vi.mocked(api.gifts.intros).mockResolvedValue({ intros: [] })
    const { rerender } = render(<IntrosSection onOpenChat={vi.fn()} refreshKey={0} />)
    await waitFor(() => expect(api.gifts.intros).toHaveBeenCalledTimes(1))

    rerender(<IntrosSection onOpenChat={vi.fn()} refreshKey={1} />)
    await waitFor(() => expect(api.gifts.intros).toHaveBeenCalledTimes(2))
  })
})
