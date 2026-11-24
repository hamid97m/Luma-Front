import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Discovery } from '../src/screens/Discovery.js'
import { api } from '../src/api.js'
import { useAuthStore, useRequestsStore } from '../src/store.js'
import { t } from '../src/i18n.js'
import { fa } from '../src/locales/fa.js'
import { en } from '../src/locales/en.js'
import { ar } from '../src/locales/ar.js'
import type { DirectChatStatus, UserProfile } from '../src/types.js'

vi.mock('../src/api.js', () => ({
  api: {
    discovery: { feed: vi.fn() },
    swipes: { swipe: vi.fn() },
    directChat: { start: vi.fn() },
    requests: { list: vi.fn(), sent: vi.fn(() => Promise.resolve({ requests: [] })) },
    premium: { status: vi.fn().mockResolvedValue({ enabled: true, premiumUntil: null, plans: [] }) },
  },
}))

const profile = (id: string, name: string) =>
  ({ id, name, age: 24, bio: 'Hi', telegramId: 1, photos: ['https://img1'], interests: [], location: null })
const QUOTA: DirectChatStatus = { gate: 'quota', remaining: 3, limit: 3, resetAt: null }
const fail = (status: number, body: object) => Object.assign(new Error(JSON.stringify(body)), { status })

const seeks = (looking_for: UserProfile['looking_for']) =>
  useAuthStore.setState({ user: { id: 'me', gender: 'man', looking_for } as UserProfile })

async function open(directChat = QUOTA, onOpenChat = vi.fn(), extra: { messageRequest?: boolean } = {}) {
  vi.mocked(api.discovery.feed).mockResolvedValue({ profiles: [{ ...profile('p1', 'Sara'), ...extra }, profile('p2', 'Mina')], exhausted: true, directChat })
  render(<Discovery onOpenChat={onOpenChat} />)
  await screen.findByText('Sara')
  fireEvent.click(screen.getByRole('button', { name: t.aria.directChat }))
  return onOpenChat
}

const write = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText(t.requests.composePlaceholder), { target: { value: text } })
const send = () => fireEvent.click(screen.getByText(t.requests.send))

beforeEach(() => { vi.clearAllMocks(); useRequestsStore.getState().reset(); seeks('women') })
afterEach(() => useAuthStore.setState({ user: null }))

describe('sender-facing copy', () => {
  it.each([fa, en, ar])('never mentions ignoring or a retry once a request is sent', ({ requests: r }) => {
    for (const text of [r.sentToast, r.sentTitle, r.waiting, r.tooManyPending, r.composeBody]) {
      expect(text).not.toMatch(/ignor|declin|reject|try again|نادیده|رد شد|دوباره تلاش|تجاهل|رفض|حاول/i)
    }
  })
})

describe('Discovery message request', () => {
  it('composes first, sends the trimmed opener, confirms and advances without a swipe', async () => {
    vi.mocked(api.directChat.start).mockResolvedValue({ request: { id: 'r1', status: 'pending' }, directChat: { remaining: 2, resetAt: null } })
    const onOpenChat = await open()
    expect(api.directChat.start).not.toHaveBeenCalled()
    expect(screen.getByText(t.directChat.remaining(3))).toBeInTheDocument()
    expect(screen.getByText(t.requests.send)).toBeDisabled()
    write('  salam  ')
    send()
    await waitFor(() => expect(api.directChat.start).toHaveBeenCalledWith('p1', 'salam'))
    await screen.findByText(t.requests.sentToast)
    expect(screen.queryByPlaceholderText(t.requests.composePlaceholder)).not.toBeInTheDocument()
    expect(screen.queryByText('Sara')).not.toBeInTheDocument()
    expect(screen.getByText('Mina')).toBeInTheDocument()
    expect(api.requests.sent).toHaveBeenCalled()
    expect(api.swipes.swipe).not.toHaveBeenCalled()
    expect(onOpenChat).not.toHaveBeenCalled()
  })

  it('a woman writing to a woman composes a request too', async () => {
    useAuthStore.setState({ user: { id: 'me', gender: 'woman', looking_for: 'everyone' } as UserProfile })
    await open({ gate: 'free', remaining: 0, limit: 3, resetAt: null }, vi.fn(), { messageRequest: true })
    expect(screen.getByPlaceholderText(t.requests.composePlaceholder)).toBeInTheDocument()
    expect(screen.queryByText(t.directChat.remaining(0))).not.toBeInTheDocument() // no quota for her
  })

  it.each([
    [true, 'men' as const],
    [false, 'women' as const],
  ])('the card flag messageRequest=%s wins over looking_for=%s', async (messageRequest, lookingFor) => {
    seeks(lookingFor)
    vi.mocked(api.directChat.start).mockResolvedValue({ created: true, match: { id: 'm1', matchedAt: '2026-01-05T10:00:00.000Z', user: { id: 'p1', name: 'Sara' } } })
    const onOpenChat = await open(QUOTA, vi.fn(), { messageRequest })
    if (messageRequest) {
      expect(screen.getByPlaceholderText(t.requests.composePlaceholder)).toBeInTheDocument()
      expect(api.directChat.start).not.toHaveBeenCalled()
    } else {
      await waitFor(() => expect(onOpenChat).toHaveBeenCalled())
      expect(api.directChat.start).toHaveBeenCalledWith('p1')
    }
  })

  it('opens the chat when the server answers with a match', async () => {
    vi.mocked(api.directChat.start).mockResolvedValue({ created: true, match: { id: 'm1', matchedAt: '2026-01-05T10:00:00.000Z', user: { id: 'p1', name: 'Sara' } } })
    const onOpenChat = await open()
    write('salam')
    send()
    await waitFor(() => expect(onOpenChat).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1', matchedAt: '2026-01-05T10:00:00.000Z' })))
    expect(screen.queryByText(t.requests.sentToast)).not.toBeInTheDocument()
  })

  it('falls back to composing on 400 message_required', async () => {
    seeks('everyone')
    vi.mocked(api.directChat.start).mockRejectedValueOnce(fail(400, { error: 'message_required' }))
    await open()
    await screen.findByPlaceholderText(t.requests.composePlaceholder)
    expect(api.directChat.start).toHaveBeenCalledWith('p1')
    vi.mocked(api.directChat.start).mockResolvedValue({ request: { id: 'r1', status: 'pending' } })
    write('salam')
    send()
    await screen.findByText(t.requests.sentToast)
    expect(api.directChat.start).toHaveBeenLastCalledWith('p1', 'salam')
  })

  it('too_many_pending keeps the sheet and the text', async () => {
    vi.mocked(api.directChat.start).mockRejectedValue(fail(403, { error: 'too_many_pending' }))
    await open()
    write('salam')
    send()
    await screen.findByText(t.requests.tooManyPending)
    expect(screen.getByPlaceholderText(t.requests.composePlaceholder)).toHaveValue('salam')
  })

  it('any other failure keeps the text and can be retried', async () => {
    vi.mocked(api.directChat.start).mockRejectedValue(fail(500, {}))
    await open()
    write('salam')
    send()
    await screen.findByText(t.requests.sendError)
    expect(screen.getByPlaceholderText(t.requests.composePlaceholder)).toHaveValue('salam')
    expect(screen.getByText(t.requests.send)).toBeEnabled()
  })

  it.each([
    [{ error: 'direct_chat_limit', resetAt: new Date(Date.now() + 3600_000).toISOString() }, () => t.directChat.limitTitle],
    [{ error: 'premium_required' }, () => t.directChat.goPremiumCta],
  ])('%o swaps the compose sheet for the existing one', async (body, expected) => {
    vi.mocked(api.directChat.start).mockRejectedValue(fail(403, body))
    await open()
    write('salam')
    send()
    await screen.findByText(expected())
    expect(screen.queryByPlaceholderText(t.requests.composePlaceholder)).not.toBeInTheDocument()
  })
})
