import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { useEffect } from 'react'

let pausedCb: (() => void) | null = null

vi.mock('../src/api.ts', () => ({
  onAccountPaused: (fn: () => void) => {
    pausedCb = fn
    return () => { if (pausedCb === fn) pausedCb = null }
  },
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
vi.mock('../src/screens/Discovery.js', () => ({ Discovery: () => <div data-testid="discovery" /> }))
vi.mock('../src/screens/Likes.js', () => ({ Likes: () => null }))
vi.mock('../src/screens/Matches.js', () => ({ Matches: () => null }))
vi.mock('../src/screens/MyProfile.js', () => ({ MyProfile: () => null }))
vi.mock('../src/components/premium/PaywallSheet.js', () => ({ PaywallSheet: () => null }))
vi.mock('../src/components/referrals/InviteSheet.js', () => ({ InviteSheet: () => null }))

import { App } from '../src/App.js'
import { api } from '../src/api.js'
import { t } from '../src/i18n.js'

const USER = {
  id: 'me', name: 'Ali', age: 27, gender: 'man', looking_for: 'women',
  bio: null, interests: [], location: 'Tehran', photos: [],
  is_active: true, setupComplete: true, paused: false, locale: 'fa',
}

describe('App mid-session pause', () => {
  beforeEach(() => {
    pausedCb = null
    vi.mocked(api.auth.verify).mockResolvedValue({ user: USER } as never)
  })

  it('locks the open app on the photo-required screen', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('discovery')).toBeInTheDocument())

    act(() => { pausedCb?.() })

    expect(screen.queryByTestId('discovery')).not.toBeInTheDocument()
    expect(screen.getByText(t.photoRequired.title)).toBeInTheDocument()
    expect(screen.getByText(t.photoRequired.body)).toBeInTheDocument()
  })
})
