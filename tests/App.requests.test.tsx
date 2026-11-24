import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { useEffect } from 'react'

vi.mock('../src/api.ts', () => ({
  onAccountPaused: () => () => {},
  api: {
    auth: { verify: vi.fn() },
    profile: { get: vi.fn(), update: vi.fn(), setLocale: vi.fn(() => Promise.resolve({ ok: true })) },
    matches: { list: vi.fn(() => Promise.resolve({ matches: [] })), unreadCount: vi.fn(() => Promise.resolve({ count: 1 })) },
    likes: { unreadCount: vi.fn(() => Promise.resolve({ count: 0 })) },
    requests: { list: vi.fn(), sent: vi.fn(() => Promise.resolve({ requests: [] })) },
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
vi.mock('../src/screens/Discovery.js', () => ({ Discovery: () => null }))
vi.mock('../src/screens/Likes.js', () => ({ Likes: () => null }))
vi.mock('../src/screens/Matches.js', () => ({
  Matches: ({ focusRequests }: { focusRequests?: boolean }) => <div data-testid="matches">{String(!!focusRequests)}</div>,
}))
vi.mock('../src/screens/MyProfile.js', () => ({ MyProfile: () => null }))
vi.mock('../src/components/premium/PaywallSheet.js', () => ({ PaywallSheet: () => null }))
vi.mock('../src/components/referrals/InviteSheet.js', () => ({ InviteSheet: () => null }))

import { App } from '../src/App.js'
import { api } from '../src/api.js'
import { dispatch } from '../src/realtime.js'
import type { MessageRequest } from '../src/types.js'

const req = (id: string) => ({ id, body: 'hi', createdAt: '', user: { id, name: id, age: 1, bio: null, location: null, interests: [], photos: [] } }) as MessageRequest

const launch = (search: string) => {
  window.history.replaceState({}, '', `/${search}`)
  render(<App />)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.auth.verify).mockResolvedValue({ user: { id: 'me', name: 'Me', setupComplete: true, locale: 'fa' } } as never)
  vi.mocked(api.requests.list).mockResolvedValue({ requests: [req('a'), req('b')] })
})
afterEach(() => window.history.replaceState({}, '', '/'))

describe('App — message requests', () => {
  it('?screen=matches&tab=requests opens Matches focused on the requests', async () => {
    launch('?screen=matches&tab=requests')
    expect(await screen.findByTestId('matches')).toHaveTextContent('true')
  })

  it('a plain ?screen=matches link does not focus them', async () => {
    launch('?screen=matches')
    expect(await screen.findByTestId('matches')).toHaveTextContent('false')
  })

  it('adds requests to the Matches badge and refreshes on a live request event', async () => {
    launch('?screen=matches')
    await screen.findByText('3') // 1 unread + 2 requests
    vi.mocked(api.requests.list).mockResolvedValue({ requests: [req('a'), req('b'), req('c')] })
    act(() => dispatch({ type: 'request' }))
    await screen.findByText('4')
  })

  it('works when the requests endpoint is missing', async () => {
    vi.mocked(api.requests.list).mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }))
    launch('?screen=matches')
    await screen.findByText('1')
    await waitFor(() => expect(api.requests.list).toHaveBeenCalled())
  })
})
