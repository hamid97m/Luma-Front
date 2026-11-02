import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import { useEffect } from 'react'

vi.mock('../src/api.ts', () => ({
  onAccountPaused: () => () => {},
  api: {
    auth: { verify: vi.fn(), me: vi.fn(), telegramWeb: vi.fn(), google: vi.fn(), dev: vi.fn() },
    profile: {
      get: vi.fn(() => new Promise(() => {})),
      update: vi.fn(),
      delete: vi.fn(),
      setWriteAccess: vi.fn(() => Promise.resolve({ ok: true })),
      setLocale: vi.fn(() => Promise.resolve({ ok: true })),
    },
    matches: { list: vi.fn(), unreadCount: vi.fn(() => Promise.resolve({ count: 0 })) },
    likes: { unreadCount: vi.fn(() => Promise.resolve({ count: 0 })) },
    premium: { status: vi.fn(() => new Promise(() => {})), checkout: vi.fn(), transaction: vi.fn() },
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
// The profile tab is where Settings lives — render the real sheet there.
vi.mock('../src/screens/MyProfile.js', async () => {
  const { SettingsSheet } = await import('../src/components/SettingsSheet.js')
  return {
    MyProfile: () => <SettingsSheet isActive onPauseChange={() => {}} onClose={() => {}} />,
  }
})
vi.mock('../src/components/referrals/InviteSheet.js', () => ({ InviteSheet: () => null }))

import { App } from '../src/App.js'
import { api } from '../src/api.js'
import { t } from '../src/i18n.js'
import { shouldPromptWriteAccessOnLaunch } from '../src/telegram.js'
import { usePremiumStore } from '../src/store.js'
import { SettingsSheet } from '../src/components/SettingsSheet.js'
import { PaywallSheet } from '../src/components/premium/PaywallSheet.js'
import { NotifyPrompt } from '../src/components/NotifyPrompt.js'
import { clearSessionToken, endSession, getSessionToken, setSessionToken } from '../src/session.js'
import type { PremiumPlan } from '../src/types.js'

const USER = {
  id: 'me', name: 'Ali', age: 27, gender: 'man', looking_for: 'women',
  bio: null, interests: [], location: 'Tehran', photos: [],
  is_active: true, setupComplete: true, paused: false, locale: 'fa',
}

const PLANS: PremiumPlan[] = [
  { id: 'p1', title: '1 Month', description: '', priceStars: 100, discountPercent: null, originalPriceStars: null, durationDays: 30, discountEndsAt: null },
]

const TG_INIT_DATA = window.Telegram!.WebApp!.initData
const ORIGINAL_LOCATION = window.location

function mockReload() {
  const reload = vi.fn()
  Object.defineProperty(window, 'location', { configurable: true, value: { ...ORIGINAL_LOCATION, reload } })
  return reload
}

function leaveTelegram() {
  ;(window.Telegram!.WebApp! as { initData: string }).initData = ''
}

/** Website launch with a stored session that /auth/me accepts. */
async function bootWebsite(tab?: 'profile') {
  leaveTelegram()
  setSessionToken('web-token')
  vi.mocked(api.auth.me).mockResolvedValue({ user: USER } as never)
  if (tab) window.history.replaceState(null, '', `/?screen=${tab}`)
  render(<App />)
  await waitFor(() => expect(screen.getByTestId('discovery')).toBeInTheDocument())
}

describe('web-only UI', () => {
  beforeEach(() => {
    vi.mocked(api.auth.verify).mockReset().mockResolvedValue({ user: USER } as never)
    vi.mocked(api.auth.me).mockReset()
    vi.mocked(api.premium.checkout).mockReset()
    vi.mocked(shouldPromptWriteAccessOnLaunch).mockReturnValue(false)
    usePremiumStore.setState({ status: { enabled: true, premiumUntil: null, plans: PLANS } })
    clearSessionToken()
  })

  afterEach(() => {
    ;(window.Telegram!.WebApp! as { initData: string }).initData = TG_INIT_DATA
    Object.defineProperty(window, 'location', { configurable: true, value: ORIGINAL_LOCATION })
    window.history.replaceState(null, '', '/')
    clearSessionToken()
  })

  it('settings shows Log out outside Telegram and not inside', () => {
    const { unmount } = render(<SettingsSheet isActive onPauseChange={() => {}} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: t.settings.logout })).not.toBeInTheDocument()
    unmount()

    leaveTelegram()
    render(<SettingsSheet isActive onPauseChange={() => {}} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: t.settings.logout })).toBeInTheDocument()
  })

  it('log out clears the token and reloads the page', async () => {
    await bootWebsite('profile')
    const reload = mockReload()

    fireEvent.click(screen.getByRole('button', { name: t.settings.logout }))

    expect(getSessionToken()).toBeNull()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('a rejected session mid-session clears the token and reloads the page', async () => {
    await bootWebsite()
    const reload = mockReload()

    act(() => endSession({ kind: 'signedOut' }))

    expect(getSessionToken()).toBeNull()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('a ban mid-session shows the blocked screen', async () => {
    await bootWebsite()
    const banned = Object.assign(
      new Error(JSON.stringify({ error: 'account_banned', botUsername: 'LumaDatingBot' })),
      { status: 401 },
    )

    act(() => endSession({ kind: 'banned', error: banned }))

    await waitFor(() => expect(screen.getByText(t.blocked.title)).toBeInTheDocument())
    expect(screen.getByText(t.blocked.support)).toBeInTheDocument()
  })

  it('paywall outside Telegram shows webUnavailable and no buy button', () => {
    leaveTelegram()
    render(<PaywallSheet open onClose={() => {}} />)

    expect(screen.getByText(t.premium.webUnavailable)).toBeInTheDocument()
    expect(screen.queryByText('1 Month')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.premium.buy(100) })).not.toBeInTheDocument()
    expect(api.premium.checkout).not.toHaveBeenCalled()
  })

  it('paywall inside Telegram unchanged', () => {
    render(<PaywallSheet open onClose={() => {}} />)

    expect(screen.queryByText(t.premium.webUnavailable)).not.toBeInTheDocument()
    expect(screen.getByText('1 Month')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.premium.buy(100) })).toBeInTheDocument()
  })

  it('notify prompt never shows outside Telegram', async () => {
    vi.mocked(shouldPromptWriteAccessOnLaunch).mockReturnValue(true)
    await bootWebsite()
    expect(screen.queryByText(t.notify.title)).not.toBeInTheDocument()

    // Other triggers (e.g. Discovery after a match) render nothing either.
    render(<NotifyPrompt onDone={() => {}} />)
    expect(screen.queryByText(t.notify.title)).not.toBeInTheDocument()
  })

  it('notify prompt still shows on launch inside Telegram', async () => {
    vi.mocked(shouldPromptWriteAccessOnLaunch).mockReturnValue(true)
    render(<App />)

    await waitFor(() => expect(screen.getByText(t.notify.title)).toBeInTheDocument())
  })
})

describe('session storage failures', () => {
  afterEach(() => vi.restoreAllMocks())

  it('set/clear never throw when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('SecurityError') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('SecurityError') })

    expect(() => setSessionToken('tok')).not.toThrow()
    expect(() => clearSessionToken()).not.toThrow()
  })
})
