import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Matches } from '../src/screens/Matches.js'
import { api } from '../src/api.js'

const BASE_MATCH = {
  id: 'match-1',
  matchedAt: '2026-01-01T00:00:00Z',
  user: {
    id: 'other-1',
    name: 'Sara',
    photos: [],
    telegramId: 99,
    username: 'sara',
    age: 24,
    bio: 'Coffee person',
    icebreakerPrompt: 'My perfect Sunday',
    icebreakerAnswer: 'Hiking then pancakes',
  },
}

describe('Matches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('shows "Say hi!" when there is no message yet', async () => {
    vi.mocked(api.matches.list).mockResolvedValue({
      matches: [{ ...BASE_MATCH, lastMessage: null, unreadCount: 0 }],
    })
    render(<Matches onOpenChat={vi.fn()} onStartDiscovering={vi.fn()} refreshKey={0} />)
    await waitFor(() => screen.getByText('Say hi!'))
  })

  it('shows the last message body when one exists', async () => {
    vi.mocked(api.matches.list).mockResolvedValue({
      matches: [{
        ...BASE_MATCH,
        lastMessage: { body: 'hey there', createdAt: '2026-01-02T00:00:00Z', senderId: 'other-1' },
        unreadCount: 0,
      }],
    })
    render(<Matches onOpenChat={vi.fn()} onStartDiscovering={vi.fn()} refreshKey={0} />)
    await waitFor(() => screen.getByText('hey there'))
  })

  it('shows an unread badge when unreadCount is greater than zero', async () => {
    vi.mocked(api.matches.list).mockResolvedValue({
      matches: [{ ...BASE_MATCH, lastMessage: null, unreadCount: 2 }],
    })
    render(<Matches onOpenChat={vi.fn()} onStartDiscovering={vi.fn()} refreshKey={0} />)
    await waitFor(() => screen.getByText('2'))
  })

  it('calls onOpenChat with the match when the open-chat button is clicked', async () => {
    vi.mocked(api.matches.list).mockResolvedValue({
      matches: [{ ...BASE_MATCH, lastMessage: null, unreadCount: 0 }],
    })
    const onOpenChat = vi.fn()
    render(<Matches onOpenChat={onOpenChat} onStartDiscovering={vi.fn()} refreshKey={0} />)
    await waitFor(() => screen.getByLabelText('Open chat'))
    fireEvent.click(screen.getByLabelText('Open chat'))
    expect(onOpenChat).toHaveBeenCalledWith(expect.objectContaining({ id: 'match-1' }))
  })

  it('refetches matches when refreshKey changes', async () => {
    vi.mocked(api.matches.list).mockResolvedValue({ matches: [] })
    const { rerender } = render(<Matches onOpenChat={vi.fn()} onStartDiscovering={vi.fn()} refreshKey={0} />)
    await waitFor(() => expect(api.matches.list).toHaveBeenCalledTimes(1))

    rerender(<Matches onOpenChat={vi.fn()} onStartDiscovering={vi.fn()} refreshKey={1} />)
    await waitFor(() => expect(api.matches.list).toHaveBeenCalledTimes(2))
  })
})
