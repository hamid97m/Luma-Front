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
vi.mock('../src/screens/Reconnect.js', () => ({
  Reconnect: () => <div data-testid="reconnect" />,
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

const newUser = () => Promise.resolve({ user: { id: 'u', name: '', setupComplete: false, paused: false, locale: null } })

function setTelegramLanguage(code: string | undefined) {
  window.Telegram!.WebApp!.initDataUnsafe!.user = { id: 123, first_name: 'Ali', username: 'ali', language_code: code } as never
}

describe('App first-open language screen', () => {
  beforeEach(() => {
    localStorage.removeItem('luma.locale.chosen_tg_id')
    localStorage.setItem('luma.locale', 'fa')
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    cleanup()
    const { stopSignupTracking } = await import('../src/signupTrack.js')
    stopSignupTracking()
    vi.unstubAllGlobals()
    setTelegramLanguage(undefined)
    localStorage.setItem('luma.locale', 'fa')
  })

  it('skips the screen for a Persian Telegram user', async () => {
    setTelegramLanguage('fa')
    await launch(newUser)
    await screen.findByTestId('onboarding')
    expect(screen.queryByTestId('picker')).toBeNull()
    expect(localStorage.getItem('luma.locale.chosen_tg_id')).toBe('123')
  })

  it('skips the screen for an Arabic Telegram user and switches to Arabic', async () => {
    setTelegramLanguage('ar')
    await launch(newUser)
    await waitFor(() => expect(localStorage.getItem('luma.locale')).toBe('ar'))
    expect(localStorage.getItem('luma.locale.chosen_tg_id')).toBe('123')
  })

  it('still shows the screen for an English Telegram user', async () => {
    setTelegramLanguage('en')
    await launch(newUser)
    await screen.findByTestId('picker')
    expect(localStorage.getItem('luma.locale.chosen_tg_id')).toBeNull()
  })

  it('still shows the screen when Telegram sends no language', async () => {
    await launch(newUser)
    await screen.findByTestId('picker')
  })
})
