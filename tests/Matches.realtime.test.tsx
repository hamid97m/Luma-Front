import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Matches } from '../src/screens/Matches.js'
import { api } from '../src/api.js'
import { dispatch, useRealtimeStore } from '../src/realtime.js'
import { useAuthStore } from '../src/store.js'
import { resetTyping } from '../src/typing.js'
import { t } from '../src/i18n.js'
import type { Match, UserProfile } from '../src/types.js'

const row = (id: string, name: string, body: string): Match => ({
  id,
  matchedAt: '2025-01-01T00:00:00Z',
  user: { id: `u-${id}`, name, photos: [], telegramId: 1, username: null, age: null, bio: null, icebreakerPrompt: null, icebreakerAnswer: null },
  lastMessage: { body, createdAt: '2025-01-02T00:00:00Z', senderId: `u-${id}`, type: 'text' },
  unreadCount: 0,
})

const isAbove = (a: string, b: string) =>
  !!(screen.getByLabelText(t.aria.openChatWith(a)).compareDocumentPosition(screen.getByLabelText(t.aria.openChatWith(b)))
    & Node.DOCUMENT_POSITION_FOLLOWING)

describe('Matches — live events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: { id: 'me-1' } as UserProfile })
    useRealtimeStore.setState({ connected: true })
    resetTyping()
    vi.mocked(api.matches.list).mockResolvedValue({ matches: [row('a', 'Ava', 'old a'), row('b', 'Bea', 'old b')] })
  })

  it('moves the row to the top with the new preview and an unread bump', async () => {
    render(<Matches onOpenChat={vi.fn()} onStartDiscovering={vi.fn()} refreshKey={0} />)
    await waitFor(() => screen.getByText('old b'))
    expect(isAbove('Ava', 'Bea')).toBe(true)
    act(() => dispatch({ type: 'message', matchId: 'b', message: { id: 'x', senderId: 'u-b', body: 'new b', createdAt: '2025-01-03T00:00:00Z', readAt: null, type: 'text' } }))
    expect(screen.getByText('new b')).toBeInTheDocument()
    expect(isAbove('Bea', 'Ava')).toBe(true)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('does not count my own messages or the open chat as unread', async () => {
    render(<Matches onOpenChat={vi.fn()} onStartDiscovering={vi.fn()} refreshKey={0} activeChatId="a" />)
    await waitFor(() => screen.getByText('old a'))
    act(() => {
      dispatch({ type: 'message', matchId: 'a', message: { id: 'x', senderId: 'u-a', body: 'in open chat', createdAt: '2025-01-03T00:00:00Z', readAt: null, type: 'text' } })
      dispatch({ type: 'message', matchId: 'b', message: { id: 'y', senderId: 'me-1', body: 'mine', createdAt: '2025-01-03T00:01:00Z', readAt: null, type: 'text' } })
    })
    expect(screen.getByText('in open chat')).toBeInTheDocument()
    expect(screen.getByText('mine')).toBeInTheDocument()
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })

  it('refetches on sync and for an unknown match', async () => {
    render(<Matches onOpenChat={vi.fn()} onStartDiscovering={vi.fn()} refreshKey={0} />)
    await waitFor(() => screen.getByText('old a'))
    expect(api.matches.list).toHaveBeenCalledTimes(1)
    act(() => dispatch({ type: 'sync' }))
    await waitFor(() => expect(api.matches.list).toHaveBeenCalledTimes(2))
    act(() => dispatch({ type: 'message', matchId: 'zzz', message: { id: 'q', senderId: 'u-z', body: 'hi', createdAt: '2025-01-03T00:00:00Z', readAt: null, type: 'text' } }))
    await waitFor(() => expect(api.matches.list).toHaveBeenCalledTimes(3), { timeout: 2000 })
  })

  it('shows typing instead of the preview until their message lands', async () => {
    render(<Matches onOpenChat={vi.fn()} onStartDiscovering={vi.fn()} refreshKey={0} />)
    await waitFor(() => screen.getByText('old b'))
    act(() => dispatch({ type: 'typing', matchId: 'b', userId: 'u-b' }))
    expect(screen.queryByText('old b')).not.toBeInTheDocument()
    expect(screen.getByText(t.chat.typing)).toBeInTheDocument()
    expect(screen.getByText('old a')).toBeInTheDocument()
    act(() => dispatch({ type: 'message', matchId: 'b', message: { id: 'x', senderId: 'u-b', body: 'new b', createdAt: '2025-01-03T00:00:00Z', readAt: null, type: 'text' } }))
    expect(screen.queryByText(t.chat.typing)).not.toBeInTheDocument()
    expect(screen.getByText('new b')).toBeInTheDocument()
  })

  it('ticks my last message and flips it to seen when they read it', async () => {
    const mine: Match = {
      ...row('c', 'Cleo', 'my hi'),
      lastMessage: { id: 'c1', body: 'my hi', createdAt: '2025-01-02T00:00:00Z', senderId: 'me-1', type: 'text', readAt: null },
    }
    vi.mocked(api.matches.list).mockResolvedValue({ matches: [mine, row('a', 'Ava', 'old a')] })
    render(<Matches onOpenChat={vi.fn()} onStartDiscovering={vi.fn()} refreshKey={0} />)
    await waitFor(() => screen.getByText('my hi'))
    expect(screen.getAllByRole('img', { name: t.aria.sent })).toHaveLength(1) // not on their message
    expect(screen.queryByRole('img', { name: t.aria.seen })).not.toBeInTheDocument()

    act(() => dispatch({ type: 'message_updated', matchId: 'c', message: { id: 'c1', senderId: 'me-1', body: 'my hi', createdAt: '2025-01-02T00:00:00Z', readAt: '2025-01-02T00:05:00Z', type: 'text' } }))
    expect(screen.getByRole('img', { name: t.aria.seen })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: t.aria.sent })).not.toBeInTheDocument()
    expect(api.matches.list).toHaveBeenCalledTimes(1) // updated in place, no refetch

    act(() => dispatch({ type: 'typing', matchId: 'c', userId: 'u-c' }))
    expect(screen.queryByRole('img', { name: t.aria.seen })).not.toBeInTheDocument()
  })

  it('a live message of mine shows the sent tick', async () => {
    render(<Matches onOpenChat={vi.fn()} onStartDiscovering={vi.fn()} refreshKey={0} />)
    await waitFor(() => screen.getByText('old a'))
    act(() => dispatch({ type: 'message', matchId: 'a', message: { id: 'z', senderId: 'me-1', body: 'sent now', createdAt: '2025-01-03T00:00:00Z', readAt: null, type: 'text' } }))
    expect(screen.getByRole('img', { name: t.aria.sent })).toBeInTheDocument()
  })
})
