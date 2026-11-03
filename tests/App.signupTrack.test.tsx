import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { StrictMode, useEffect } from 'react'

vi.mock('../src/api.ts', () => ({
  onAccountPaused: () => () => {},
  api: {
    auth: { verify: vi.fn() },
    profile: { get: vi.fn(() => Promise.resolve({})), setLocale: vi.fn(() => Promise.resolve({ ok: true })) },
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
vi.mock('../src/i18n/geo.js', () => ({
  geoCountrySync: () => null,
  prefetchGeoCountry: () => Promise.resolve(null),
}))
vi.mock('../src/screens/Discovery.js', () => ({ Discovery: () => <div data-testid="discovery" /> }))
vi.mock('../src/screens/Likes.js', () => ({ Likes: () => null }))
vi.mock('../src/screens/Matches.js', () => ({ Matches: () => null }))
vi.mock('../src/screens/MyProfile.js', () => ({ MyProfile: () => null }))
vi.mock('../src/components/premium/PaywallSheet.js', () => ({ PaywallSheet: () => null }))
vi.mock('../src/components/referrals/InviteSheet.js', () => ({ InviteSheet: () => null }))
vi.mock('../src/screens/Onboarding.js', () => ({
  Onboarding: () => <div data-testid="onboarding" />,
}))
vi.mock('../src/screens/LanguagePicker.js', () => ({
  LanguagePicker: () => <div data-testid="picker" />,
}))

const fetchMock = vi.fn()
const sentNames = () =>
  fetchMock.mock.calls.flatMap(([, init]) =>
    (JSON.parse((init as RequestInit).body as string).events as { name: string }[]).map((e) => e.name))

async function launch(verify: () => Promise<unknown>) {
  vi.resetModules()
  const { api } = await import('../src/api.js')
  vi.mocked(api.auth.verify).mockImplementation(verify as never)
  const { App } = await import('../src/App.js')
  render(<StrictMode><App /></StrictMode>)
  return api
}

describe('App signup tracking', () => {
  beforeEach(() => {
    localStorage.removeItem('luma_setup_complete_tg_id')
    localStorage.removeItem('luma_signup_done')
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    cleanup()
    // Silence this launch's tracker so its flush timer can't reach the next test.
    const { stopSignupTracking } = await import('../src/signupTrack.js')
    stopSignupTracking()
    vi.unstubAllGlobals()
  })

  it('tracks a brand-new user once despite StrictMode double effects', async () => {
    await launch(() => Promise.resolve({ user: { id: 'u', name: '', setupComplete: false, paused: false, locale: null } }))
    await screen.findByTestId('picker')
    await waitFor(() => expect(sentNames()).toEqual(expect.arrayContaining(['app_open', 'auth_ok', 'picker_view'])), { timeout: 3000 })
    expect(sentNames().filter((n) => n === 'app_open')).toHaveLength(1)
    expect(sentNames().filter((n) => n === 'auth_ok')).toHaveLength(1)
    expect(sentNames().filter((n) => n === 'picker_view')).toHaveLength(1)
  })

  it('sends nothing for a returning user', async () => {
    await launch(() => Promise.resolve({ user: { id: 'u', name: 'Ali', setupComplete: true, paused: false, locale: 'fa', gender: 'man' } }))
    await screen.findByTestId('discovery')
    await new Promise((r) => setTimeout(r, 1700))
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('signup-events'))).toHaveLength(0)
  })

  it('keeps the verify-failure fallthrough to onboarding and reports the status', async () => {
    await launch(() => Promise.reject(Object.assign(new Error('nope'), { status: 500 })))
    await waitFor(() => expect(screen.queryByTestId('picker') ?? screen.queryByTestId('onboarding')).toBeTruthy())
    await waitFor(() => expect(sentNames()).toEqual(expect.arrayContaining(['app_open', 'auth_failed'])), { timeout: 3000 })
    const events = fetchMock.mock.calls.flatMap(([, init]) => JSON.parse((init as RequestInit).body as string).events)
    expect(events).toContainEqual({ name: 'auth_failed', detail: '500' })
  })

  it('sends nothing for a banned user', async () => {
    await launch(() => Promise.reject(Object.assign(new Error('{"error":"account_banned"}'), { status: 401 })))
    await waitFor(() => expect(screen.queryByTestId('picker')).toBeNull())
    await new Promise((r) => setTimeout(r, 1700))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
