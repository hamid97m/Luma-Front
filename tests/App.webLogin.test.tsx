import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'

vi.mock('../src/api.ts', () => ({
  onAccountPaused: () => () => {},
  api: {
    auth: { verify: vi.fn(), me: vi.fn() },
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
vi.mock('../src/screens/Discovery.js', () => ({ Discovery: () => <div data-testid="discovery" /> }))
vi.mock('../src/screens/Likes.js', () => ({ Likes: () => null }))
vi.mock('../src/screens/Matches.js', () => ({ Matches: () => null }))
vi.mock('../src/screens/MyProfile.js', () => ({ MyProfile: () => null }))
vi.mock('../src/components/premium/PaywallSheet.js', () => ({ PaywallSheet: () => null }))
vi.mock('../src/components/referrals/InviteSheet.js', () => ({ InviteSheet: () => null }))

import { App } from '../src/App.js'
import { api } from '../src/api.js'
import { t } from '../src/i18n.js'
import { getSessionToken, setSessionToken, clearSessionToken } from '../src/session.js'

const USER = {
  id: 'me', name: 'Ali', age: 27, gender: 'man', looking_for: 'women',
  bio: null, interests: [], location: 'Tehran', photos: [],
  is_active: true, setupComplete: true, paused: false, locale: 'fa',
}

const TG_INIT_DATA = window.Telegram!.WebApp!.initData

function leaveTelegram() {
  ;(window.Telegram!.WebApp! as { initData: string }).initData = ''
}

describe('App boot: web login vs Telegram', () => {
  beforeEach(() => {
    vi.mocked(api.auth.verify).mockReset().mockResolvedValue({ user: USER } as never)
    vi.mocked(api.auth.me).mockReset()
    clearSessionToken()
  })

  afterEach(() => {
    ;(window.Telegram!.WebApp! as { initData: string }).initData = TG_INIT_DATA
    clearSessionToken()
  })

  it('inside Telegram with a stored token → calls /auth/verify, never shows login', async () => {
    setSessionToken('web-token')
    render(<App />)

    await waitFor(() => expect(screen.getByTestId('discovery')).toBeInTheDocument())
    expect(api.auth.verify).toHaveBeenCalledWith(TG_INIT_DATA)
    expect(api.auth.me).not.toHaveBeenCalled()
    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument()
  })

  it('outside Telegram, no token → login screen', async () => {
    leaveTelegram()
    render(<App />)

    await waitFor(() => expect(screen.getByTestId('login-screen')).toBeInTheDocument())
    expect(api.auth.verify).not.toHaveBeenCalled()
    expect(api.auth.me).not.toHaveBeenCalled()
  })

  it('outside Telegram, valid token → /auth/me → main', async () => {
    leaveTelegram()
    setSessionToken('web-token')
    vi.mocked(api.auth.me).mockResolvedValue({ user: USER } as never)
    render(<App />)

    await waitFor(() => expect(screen.getByTestId('discovery')).toBeInTheDocument())
    expect(api.auth.me).toHaveBeenCalledTimes(1)
    expect(api.auth.verify).not.toHaveBeenCalled()
  })

  it('outside Telegram, token 401 → token cleared, login screen', async () => {
    leaveTelegram()
    setSessionToken('stale-token')
    vi.mocked(api.auth.me).mockRejectedValue(
      Object.assign(new Error(JSON.stringify({ error: 'invalid_session' })), { status: 401 }),
    )
    render(<App />)

    await waitFor(() => expect(screen.getByTestId('login-screen')).toBeInTheDocument())
    expect(getSessionToken()).toBeNull()
  })

  it('outside Telegram, deleted account 401 → token cleared, login screen', async () => {
    leaveTelegram()
    setSessionToken('web-token')
    vi.mocked(api.auth.me).mockRejectedValue(
      Object.assign(new Error(JSON.stringify({ error: 'account_deleted' })), { status: 401 }),
    )
    render(<App />)

    await waitFor(() => expect(screen.getByTestId('login-screen')).toBeInTheDocument())
    expect(getSessionToken()).toBeNull()
  })

  it('outside Telegram, banned account → blocked screen', async () => {
    leaveTelegram()
    setSessionToken('web-token')
    vi.mocked(api.auth.me).mockRejectedValue(
      Object.assign(new Error(JSON.stringify({ error: 'account_banned', botUsername: 'LumaDatingBot' })), { status: 401 }),
    )
    render(<App />)

    await waitFor(() => expect(screen.getByText(t.blocked.title)).toBeInTheDocument())
    expect(screen.getByText(t.blocked.support)).toBeInTheDocument()
    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument()
  })

  it('outside Telegram, network error → keeps the token, reconnect screen', async () => {
    leaveTelegram()
    setSessionToken('web-token')
    vi.mocked(api.auth.me).mockRejectedValue(new TypeError('Failed to fetch'))
    render(<App />)

    await waitFor(() => expect(screen.getByText(t.reconnect.title)).toBeInTheDocument())
    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument()
    expect(getSessionToken()).toBe('web-token')
  })
})
