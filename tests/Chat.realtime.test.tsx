import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Chat } from '../src/screens/Chat.js'
import { api } from '../src/api.js'
import { dispatch, useRealtimeStore } from '../src/realtime.js'
import { resetTyping } from '../src/typing.js'
import { t } from '../src/i18n.js'
import type { Match, Message } from '../src/types.js'

vi.mock('../src/api.js', () => ({
  api: {
    matches: { list: vi.fn() },
    messages: { list: vi.fn(), send: vi.fn(), edit: vi.fn(), delete: vi.fn(), markRead: vi.fn(() => Promise.resolve({ ok: true })), typing: vi.fn(() => Promise.resolve({ ok: true })) },
    premium: { status: vi.fn() },
  },
}))

const MATCH: Match = {
  id: 'match-1',
  matchedAt: '2026-01-01T00:00:00Z',
  user: {
    id: 'other-1', name: 'Sara', photos: [], telegramId: 99, username: 'sara',
    age: 24, bio: null, icebreakerPrompt: null, icebreakerAnswer: null,
  },
  lastMessage: null,
  unreadCount: 0,
}

const m = (id: string, body: string, senderId = 'me-1', at = '10:01:00'): Message =>
  ({ id, senderId, body, createdAt: `2026-01-01T${at}Z`, readAt: null, type: 'text', replyToMessageId: null })

async function openChat(initial: Message[] = [m('m0', 'first', 'other-1', '10:00:00')]) {
  vi.mocked(api.messages.list).mockResolvedValue({ messages: initial })
  render(<Chat match={MATCH} myUserId="me-1" onBack={vi.fn()} />)
  await waitFor(() => screen.getByPlaceholderText(t.chat.placeholder))
}

function type(text: string) {
  fireEvent.change(screen.getByPlaceholderText(t.chat.placeholder), { target: { value: text } })
  fireEvent.click(screen.getByLabelText(t.chat.send))
}

describe('Chat — live events', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows one bubble when the live event beats the POST response', async () => {
    await openChat()
    let resolveSend!: (v: { message: Message }) => void
    vi.mocked(api.messages.send).mockReturnValue(new Promise((r) => { resolveSend = r }))
    type('yo')
    expect(screen.getAllByText('yo')).toHaveLength(1)

    act(() => dispatch({ type: 'message', matchId: 'match-1', message: m('s1', 'yo') }))
    expect(screen.getAllByText('yo')).toHaveLength(1)

    await act(async () => resolveSend({ message: m('s1', 'yo') }))
    expect(screen.getAllByText('yo')).toHaveLength(1)
  })

  it('shows one bubble when the POST response beats the live event', async () => {
    await openChat()
    vi.mocked(api.messages.send).mockResolvedValue({ message: m('s1', 'yo') })
    type('yo')
    await waitFor(() => expect(api.messages.send).toHaveBeenCalled())
    await act(async () => {})
    act(() => dispatch({ type: 'message', matchId: 'match-1', message: m('s1', 'yo') }))
    expect(screen.getAllByText('yo')).toHaveLength(1)
  })

  it('appends their message, marks it read (debounced), ignores other chats', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      await openChat()
      act(() => {
        dispatch({ type: 'message', matchId: 'match-1', message: m('t1', 'hello', 'other-1', '10:02:00') })
        dispatch({ type: 'message', matchId: 'match-1', message: m('t2', 'there', 'other-1', '10:03:00') })
        dispatch({ type: 'message', matchId: 'match-2', message: m('x', 'elsewhere', 'other-2') })
      })
      expect(screen.getByText('hello')).toBeInTheDocument()
      expect(screen.getByText('there')).toBeInTheDocument()
      expect(screen.queryByText('elsewhere')).not.toBeInTheDocument()
      await act(async () => { vi.advanceTimersByTime(500) })
      expect(api.messages.markRead).toHaveBeenCalledTimes(1)
      expect(api.messages.markRead).toHaveBeenCalledWith('match-1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('applies edits and deletes in place', async () => {
    await openChat([m('m0', 'first', 'other-1', '10:00:00'), m('m1', 'second', 'other-1', '10:00:30')])
    act(() => dispatch({ type: 'message_updated', matchId: 'match-1', message: { ...m('m0', 'first (edited)', 'other-1', '10:00:00'), editedAt: '2026-01-01T10:05:00Z' } }))
    expect(screen.getByText('first (edited)')).toBeInTheDocument()
    act(() => dispatch({ type: 'message_deleted', matchId: 'match-1', messageId: 'm1' }))
    expect(screen.queryByText('second')).not.toBeInTheDocument()
  })

  it('on sync fetches only messages after the last confirmed one', async () => {
    await openChat()
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [m('t9', 'missed', 'other-1', '10:09:00')] })
    act(() => dispatch({ type: 'sync' }))
    await waitFor(() => screen.getByText('missed'))
    expect(api.messages.list).toHaveBeenLastCalledWith('match-1', 'm0')
    expect(screen.getByText('first')).toBeInTheDocument()
  })
})

describe('Chat — typing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetTyping()
    useRealtimeStore.setState({ connected: true })
  })

  const edit = (text: string) =>
    fireEvent.change(screen.getByPlaceholderText(t.chat.placeholder), { target: { value: text } })

  it('shows typing in the header until their message arrives', async () => {
    await openChat()
    expect(screen.queryByText(t.chat.typing)).not.toBeInTheDocument()
    act(() => dispatch({ type: 'typing', matchId: 'match-2', userId: 'other-2' }))
    expect(screen.queryByText(t.chat.typing)).not.toBeInTheDocument()
    act(() => dispatch({ type: 'typing', matchId: 'match-1', userId: 'other-1' }))
    expect(screen.getByText(t.chat.typing)).toBeInTheDocument()
    act(() => dispatch({ type: 'message', matchId: 'match-1', message: m('t1', 'hey', 'other-1', '10:02:00') }))
    expect(screen.queryByText(t.chat.typing)).not.toBeInTheDocument()
  })

  it('pings typing at most once per 3 s while editing, not on send, and again right after', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    try {
      await openChat()
      vi.mocked(api.messages.send).mockReturnValue(new Promise(() => {}))
      edit('h')
      edit('he')
      edit('hel')
      expect(api.messages.typing).toHaveBeenCalledTimes(1)
      expect(api.messages.typing).toHaveBeenCalledWith('match-1')
      now.mockReturnValue(1_003_000)
      edit('hell')
      expect(api.messages.typing).toHaveBeenCalledTimes(2)
      fireEvent.click(screen.getByLabelText(t.chat.send))
      expect(api.messages.typing).toHaveBeenCalledTimes(2)
      edit('n')
      expect(api.messages.typing).toHaveBeenCalledTimes(3)
      edit('')
      expect(api.messages.typing).toHaveBeenCalledTimes(3)
    } finally {
      now.mockRestore()
    }
  })

  it('does not ping while the live stream is down', async () => {
    useRealtimeStore.setState({ connected: false })
    await openChat()
    edit('hello')
    expect(api.messages.typing).not.toHaveBeenCalled()
  })

  it('the header avatar shows their online dot from presence events', async () => {
    useRealtimeStore.setState({ connected: true })
    await openChat()
    const dot = screen.getByTestId('online-dot')
    expect(dot.dataset.online).toBe('false')
    act(() => dispatch({ type: 'presence', userId: 'other-1', online: true }))
    expect(dot.dataset.online).toBe('true')
    act(() => dispatch({ type: 'presence', userId: 'other-1', online: false }))
    expect(dot.dataset.online).toBe('false')
  })
})
