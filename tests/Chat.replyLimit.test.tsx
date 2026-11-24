import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Chat } from '../src/screens/Chat.js'
import { api } from '../src/api.js'
import { dispatch, useRealtimeStore } from '../src/realtime.js'
import { useAuthStore } from '../src/store.js'
import { t } from '../src/i18n.js'
import type { Match, Message, UserProfile } from '../src/types.js'

vi.mock('../src/api.js', () => ({
  api: {
    matches: { list: vi.fn() },
    messages: { list: vi.fn(), send: vi.fn(), edit: vi.fn(), delete: vi.fn(), markRead: vi.fn(() => Promise.resolve({ ok: true })), typing: vi.fn(() => Promise.resolve({ ok: true })) },
    gifts: { catalog: vi.fn(() => Promise.resolve({ gifts: [{ giftId: 'g', emoji: '🌹', chargedStars: 10 }] })) },
    premium: { status: vi.fn() },
  },
}))

const MATCH: Match = {
  id: 'match-1', matchedAt: '2027-01-01T00:00:00Z',
  user: { id: 'her', name: 'Sara', photos: [], telegramId: 99, username: null, age: 24, bio: null, icebreakerPrompt: null, icebreakerAnswer: null },
  lastMessage: null, unreadCount: 0,
}
const m = (id: string, body: string, senderId = 'me', type: Message['type'] = 'text'): Message =>
  ({ id, senderId, body, createdAt: '2027-01-01T10:01:00Z', readAt: null, type, replyToMessageId: null })
const THEIR_ICEBREAKER = m('i', 'prompt', 'her', 'icebreaker')
const input = () => screen.getByPlaceholderText(t.chat.placeholder)
const live = (message: Message) => act(() => dispatch({ type: 'message', matchId: 'match-1', message }))
const send = (text: string) => {
  fireEvent.change(input(), { target: { value: text } })
  fireEvent.click(screen.getByLabelText(t.chat.send))
}

async function open(messages: Message[], { gender = 'man', match = MATCH }: { gender?: UserProfile['gender']; match?: Match } = {}) {
  useAuthStore.setState({ user: { id: 'me', gender } as UserProfile })
  vi.mocked(api.messages.list).mockResolvedValue({ messages })
  render(<Chat match={match} myUserId="me" onBack={vi.fn()} />)
  await waitFor(input)
}
const expectLocked = () => {
  expect(screen.getByText(t.chat.awaitingReply)).toBeInTheDocument()
  expect(input()).toBeDisabled()
}
const expectFree = () => {
  expect(screen.queryByText(t.chat.awaitingReply)).not.toBeInTheDocument()
  expect(input()).toBeEnabled()
}

describe('Chat — reply limit', () => {
  beforeEach(() => { vi.clearAllMocks(); useRealtimeStore.setState({ connected: true }) })
  afterEach(() => useAuthStore.setState({ user: null }))

  it('empty chat: notice, then locked after one message', async () => {
    vi.mocked(api.messages.send).mockResolvedValue({ message: m('s1', 'hi') })
    await open([])
    expect(screen.getByText(t.chat.oneMessageNotice)).toBeInTheDocument()
    expectFree()
    send('hi')
    await waitFor(expectLocked)
    expect(screen.queryByText(t.chat.oneMessageNotice)).not.toBeInTheDocument()
    await act(async () => {})
    expectLocked()
  })

  it('his one message cannot be deleted while locked (deleting would free another)', async () => {
    await open([m('a', 'opener')])
    expectLocked()
    fireEvent.contextMenu(screen.getByText('opener'))
    expect(await screen.findByText(t.chat.editAction)).toBeInTheDocument()
    expect(screen.queryByText(t.chat.deleteAction)).not.toBeInTheDocument()
  })

  it('a suggested opener counts as the one message', async () => {
    vi.mocked(api.messages.send).mockResolvedValue({ message: m('s1', t.chat.openers[0]) })
    await open([])
    fireEvent.click(screen.getByText(t.chat.openers[0]))
    fireEvent.click(screen.getByLabelText(t.chat.send))
    await waitFor(expectLocked)
  })

  it('an accepted opener locks; a live reply unlocks; their icebreaker does not', async () => {
    await open([m('a', 'opener')])
    expectLocked()
    live(THEIR_ICEBREAKER)
    expectLocked()
    live(m('r', 'hey!', 'her'))
    expectFree()
  })

  it('a live gift unlocks', async () => {
    await open([m('a', 'opener')])
    live(m('g', '', 'her', 'gift'))
    expectFree()
  })

  it('a refresh that missed the live reply does not lock again', async () => {
    await open([m('a', 'opener')])
    live(m('r', 'hey!', 'her'))
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) }) // the mock still has no reply
    expect(api.messages.list).toHaveBeenCalledTimes(2)
    expectFree()
  })

  it('a failed send unlocks again, and its retry is allowed', async () => {
    vi.mocked(api.messages.send).mockRejectedValueOnce(new Error('offline'))
    await open([THEIR_ICEBREAKER])
    send('hi')
    const bubble = await screen.findByText(t.chat.failed, { exact: false })
    expectFree()
    expect(screen.getByText(t.chat.oneMessageNotice)).toBeInTheDocument()
    vi.mocked(api.messages.send).mockResolvedValue({ message: m('s1', 'hi') })
    fireEvent.click(bubble)
    await waitFor(expectLocked)
    expect(api.messages.send).toHaveBeenCalledTimes(2)
  })

  it('while locked, a failed bubble cannot be retried', async () => {
    vi.mocked(api.messages.send).mockRejectedValueOnce(new Error('offline'))
    await open([THEIR_ICEBREAKER])
    send('first')
    const failed = await screen.findByText(t.chat.failed, { exact: false })
    vi.mocked(api.messages.send).mockResolvedValue({ message: m('s1', 'second') })
    send('second')
    await waitFor(expectLocked)
    fireEvent.click(failed)
    fireEvent.contextMenu(screen.getByText('first'))
    expect(screen.queryByText(t.chat.retryMessage)).not.toBeInTheDocument()
    expect(api.messages.send).toHaveBeenCalledTimes(2)
  })

  it('while locked, no icebreaker answer or reply action, but editing works', async () => {
    vi.mocked(api.messages.edit).mockResolvedValue({ message: m('a', 'fixed') })
    await open([THEIR_ICEBREAKER, m('a', 'opener')])
    expectLocked()
    expect(screen.queryByText(t.chat.answerIt)).not.toBeInTheDocument()
    fireEvent.contextMenu(screen.getByText('opener'))
    expect(screen.queryByText(t.chat.replyAction)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(t.chat.editAction))
    expect(input()).toBeEnabled()
    fireEvent.change(input(), { target: { value: 'fixed' } })
    fireEvent.click(screen.getByLabelText(t.chat.save))
    await screen.findByText('fixed')
    expectLocked()
    expect(api.messages.send).not.toHaveBeenCalled()
  })

  it('while locked, a gift can be sent but without a note', async () => {
    await open([m('a', 'opener')])
    fireEvent.click(screen.getByLabelText(t.gifts.openButton))
    await screen.findByText('🌹')
    expect(screen.queryByPlaceholderText(t.gifts.notePlaceholder)).not.toBeInTheDocument()
  })

  it('partial history never locks', async () => {
    useAuthStore.setState({ user: { id: 'me', gender: 'man' } as UserProfile })
    vi.mocked(api.messages.list).mockRejectedValueOnce(new Error('offline'))
    render(<Chat match={MATCH} myUserId="me" onBack={vi.fn()} />)
    await screen.findByText(t.chat.loadError)
    live(m('a', 'sent from another device'))
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [] }) // the catch-up after that message
    await act(async () => dispatch({ type: 'sync' }))
    await waitFor(input)
    expectFree()
    expect(screen.queryByText(t.chat.oneMessageNotice)).not.toBeInTheDocument()
  })

  it.each([
    ['a woman', { gender: 'woman' as const }],
    ['a nonbinary viewer', { gender: 'nonbinary' as const }],
    ['an older match', { match: { ...MATCH, matchedAt: '2026-01-01T00:00:00Z' } }],
  ])('%s sees no notice and is never locked', async (_name, opts) => {
    await open([m('a', 'one'), m('b', 'two')], opts)
    expectFree()
    expect(screen.queryByText(t.chat.oneMessageNotice)).not.toBeInTheDocument()
  })
})
