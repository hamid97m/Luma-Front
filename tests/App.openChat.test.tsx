import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { useEffect } from 'react'
import type { Match } from '../src/types.js'

vi.mock('../src/api.ts', () => ({
  api: {
    auth: { verify: vi.fn() },
    profile: { get: vi.fn(), update: vi.fn(), setLocale: vi.fn(() => Promise.resolve({ ok: true })) },
    matches: { list: vi.fn(), unreadCount: vi.fn(() => Promise.resolve({ count: 0 })) },
    likes: { unreadCount: vi.fn(() => Promise.resolve({ count: 0 })) },
    premium: { status: vi.fn(() => Promise.reject(new Error('n/a'))) },
    referrals: { me: vi.fn(() => Promise.reject(new Error('n/a'))) },
  },
}))
vi.mock('../src/screens/Splash.js', () => ({
  Splash: ({ onDone }: { onDone: () => void }) => {
    useEffect(() => { onDone() }, [])
    return null
  },
}))
vi.mock('../src/telegram.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/telegram.js')>()),
  initTelegram: vi.fn(),
  shouldPromptWriteAccessOnLaunch: vi.fn(() => false),
}))

// Tabs are stubs that open a chat with whatever match the test hands them.
let discoveryOpenChat: (m: Match) => void = () => {}
let likesOpenChat: (m: Match) => void = () => {}
vi.mock('../src/screens/Discovery.js', () => ({
  Discovery: ({ onOpenChat }: { onOpenChat: (m: Match) => void }) => {
    discoveryOpenChat = onOpenChat
    return <div data-testid="discovery" />
  },
}))
vi.mock('../src/screens/Likes.js', () => ({
  Likes: ({ onOpenChat }: { onOpenChat: (m: Match) => void }) => {
    likesOpenChat = onOpenChat
    return <div data-testid="likes" />
  },
}))
vi.mock('../src/screens/Matches.js', () => ({ Matches: () => null }))
vi.mock('../src/screens/MyProfile.js', () => ({ MyProfile: () => null }))
vi.mock('../src/components/premium/PaywallSheet.js', () => ({ PaywallSheet: () => null }))
vi.mock('../src/components/referrals/InviteSheet.js', () => ({ InviteSheet: () => null }))

const chatMounts = vi.fn()
vi.mock('../src/screens/Chat.js', () => ({
  Chat: ({ match, onBack }: { match: Match; onBack: () => void }) => {
    useEffect(() => { chatMounts() }, [])
    return (
      <div data-testid="chat">
        <span data-testid="chat-photos">{match.user.photos.length}</span>
        <span data-testid="chat-bio">{match.user.bio ?? ''}</span>
        <button onClick={onBack}>back</button>
      </div>
    )
  },
}))

import { App } from '../src/App.js'
import { api } from '../src/api.js'
import { t } from '../src/i18n.js'

const synthesized = (id: string): Match => ({
  id,
  matchedAt: '2026-10-09T10:00:00.000Z',
  user: {
    id: 'u2', name: 'Sara', telegramId: 2, username: null,
    photos: [], age: null, bio: null, icebreakerPrompt: null, icebreakerAnswer: null,
  },
  lastMessage: null,
  unreadCount: 0,
})

const full = (id: string): Match => ({
  ...synthesized(id),
  user: {
    ...synthesized(id).user,
    photos: ['http://x/1.jpg', 'http://x/2.jpg'], age: 24, bio: 'Hi there',
    icebreakerPrompt: 'P', icebreakerAnswer: 'A',
  },
})

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

async function renderMain() {
  render(<App />)
  await screen.findByTestId('discovery')
}

describe('App openChat — fresh matches get their full data', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('luma.locale', 'fa')
    vi.clearAllMocks()
    vi.mocked(api.auth.verify).mockResolvedValue({
      user: { id: 'u1', name: 'Ali', setupComplete: true, paused: false, locale: 'fa' } as never,
    })
  })

  it('replaces a synthesized match from Discovery with the fetched full match, keeping the chat mounted', async () => {
    vi.mocked(api.matches.list).mockResolvedValue({ matches: [full('other'), full('m1')] } as never)
    await renderMain()

    act(() => discoveryOpenChat(synthesized('m1')))
    expect(screen.getByTestId('chat')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByTestId('chat-photos')).toHaveTextContent('2'))
    expect(screen.getByTestId('chat-bio')).toHaveTextContent('Hi there')
    expect(api.matches.list).toHaveBeenCalledTimes(1)
    expect(chatMounts).toHaveBeenCalledTimes(1)
  })

  it('does the same for a synthesized match opened from Likes', async () => {
    vi.mocked(api.matches.list).mockResolvedValue({ matches: [full('m2')] } as never)
    await renderMain()
    fireEvent.click(screen.getByText(t.nav.likes))
    await screen.findByTestId('likes')

    act(() => likesOpenChat(synthesized('m2')))
    expect(screen.getByTestId('chat')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('chat-photos')).toHaveTextContent('2'))
  })

  it('does not refetch when the opened match already has photos', async () => {
    await renderMain()

    act(() => discoveryOpenChat(full('m1')))
    expect(screen.getByTestId('chat-photos')).toHaveTextContent('2')
    expect(api.matches.list).not.toHaveBeenCalled()
  })

  it('a late response never reopens a chat the user already closed', async () => {
    const list = deferred<{ matches: Match[] }>()
    vi.mocked(api.matches.list).mockReturnValue(list.promise as never)
    await renderMain()

    act(() => discoveryOpenChat(synthesized('m1')))
    fireEvent.click(screen.getByText('back'))
    expect(screen.queryByTestId('chat')).toBeNull()

    await act(async () => { list.resolve({ matches: [full('m1')] }) })
    expect(screen.queryByTestId('chat')).toBeNull()
  })

  it('a late response never replaces a different chat opened meanwhile', async () => {
    const list = deferred<{ matches: Match[] }>()
    vi.mocked(api.matches.list).mockReturnValueOnce(list.promise as never)
    await renderMain()

    act(() => discoveryOpenChat(synthesized('m1')))
    fireEvent.click(screen.getByText('back'))
    act(() => discoveryOpenChat({ ...full('m3'), user: { ...full('m3').user, bio: 'Third' } }))

    await act(async () => { list.resolve({ matches: [full('m1')] }) })
    expect(screen.getByTestId('chat-bio')).toHaveTextContent('Third')
  })

  it('keeps the synthesized match when the refetch fails or the match is missing', async () => {
    vi.mocked(api.matches.list).mockRejectedValueOnce(new Error('offline'))
    await renderMain()

    act(() => discoveryOpenChat(synthesized('m1')))
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('chat-photos')).toHaveTextContent('0')

    fireEvent.click(screen.getByText('back'))
    vi.mocked(api.matches.list).mockResolvedValueOnce({ matches: [full('zzz')] } as never)
    act(() => discoveryOpenChat(synthesized('m1')))
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('chat-photos')).toHaveTextContent('0')
  })
})
