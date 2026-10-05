import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useEffect } from 'react'
import { fa } from '../src/locales/fa.js'

// The real Splash holds the screen for 2.6s; collapse it so auth gating runs.
vi.mock('../src/screens/Splash.js', () => ({
  Splash: ({ onDone }: { onDone: () => void }) => {
    useEffect(() => { onDone() }, [])
    return null
  },
}))
// Onboarding is heavy and not under test here — a marker is enough.
vi.mock('../src/screens/Onboarding.js', () => ({
  Onboarding: () => <div data-testid="onboarding" />,
}))
vi.mock('../src/telegram.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/telegram.js')>()),
  initTelegram: vi.fn(),
}))
// No network in tests — the picker's IP-country fallback resolves to "unknown".
vi.mock('../src/i18n/geo.js', () => ({
  geoCountrySync: vi.fn(() => null),
  prefetchGeoCountry: vi.fn(() => Promise.resolve(null)),
}))

import { App, healMissingLocale, syncLocaleFromServer } from '../src/App.js'
import { prefetchGeoCountry } from '../src/i18n/geo.js'
import { useLocaleStore } from '../src/i18n.js'
import { setLocalePending, isLocalePending } from '../src/i18n/locale.js'
import { api } from '../src/api.js'

describe('syncLocaleFromServer', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    useLocaleStore.getState().setLocale('fa')
  })
  afterEach(() => {
    setLocalePending(false)
    useLocaleStore.getState().setLocale('fa')
  })

  it('server value wins when nothing is pending', () => {
    expect(syncLocaleFromServer('en')).toBe('synced')
    expect(useLocaleStore.getState().locale).toBe('en')
    expect(localStorage.getItem('luma.locale')).toBe('en')
    expect(api.profile.setLocale).not.toHaveBeenCalled()
  })

  it('matching server value is a no-op', () => {
    expect(syncLocaleFromServer('fa')).toBe('kept')
    expect(useLocaleStore.getState().locale).toBe('fa')
  })

  it('null / undefined / junk server locale keeps the local choice', () => {
    expect(syncLocaleFromServer(null)).toBe('kept')
    expect(syncLocaleFromServer(undefined)).toBe('kept')
    expect(syncLocaleFromServer('xx' as never)).toBe('kept')
    expect(useLocaleStore.getState().locale).toBe('fa')
    expect(api.profile.setLocale).not.toHaveBeenCalled()
  })

  it('pending local change is re-sent instead of being overwritten, and the flag clears on success', async () => {
    useLocaleStore.getState().setLocale('ar')
    setLocalePending(true)
    expect(syncLocaleFromServer('fa')).toBe('resent')
    expect(useLocaleStore.getState().locale).toBe('ar')
    expect(api.profile.setLocale).toHaveBeenCalledWith('ar')
    await waitFor(() => expect(isLocalePending()).toBe(false))
  })

  it('pending flag stays set when the re-send fails', async () => {
    vi.mocked(api.profile.setLocale).mockRejectedValueOnce(new Error('offline'))
    useLocaleStore.getState().setLocale('en')
    setLocalePending(true)
    expect(syncLocaleFromServer('fa')).toBe('resent')
    await Promise.resolve()
    await Promise.resolve()
    expect(isLocalePending()).toBe(true)
    expect(useLocaleStore.getState().locale).toBe('en')
  })
})

describe('healMissingLocale', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLocaleStore.setState({ locale: 'en' })
  })
  afterEach(() => useLocaleStore.getState().setLocale('fa'))

  it('persists the device locale for a finished profile the server has no locale for', () => {
    expect(healMissingLocale(null)).toBe(true)
    expect(api.profile.setLocale).toHaveBeenCalledWith('en')
  })

  it('leaves a profile with a saved locale alone', () => {
    expect(healMissingLocale('fa')).toBe(false)
    expect(api.profile.setLocale).not.toHaveBeenCalled()
  })

  it('swallows a failed write (retried implicitly on a later Settings change)', async () => {
    vi.mocked(api.profile.setLocale).mockRejectedValueOnce(new Error('offline'))
    expect(healMissingLocale(null)).toBe(true)
    await Promise.resolve()
    await Promise.resolve()
    // No unhandled rejection; nothing else to assert.
  })
})

describe('App language-picker gating', () => {
  const verifyWith = (locale: 'fa' | 'en' | 'ar' | null) =>
    vi.mocked(api.auth.verify).mockResolvedValue({
      user: { id: 'u1', name: 'Ali', setupComplete: false, paused: false, locale } as never,
    })

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    useLocaleStore.setState({ locale: 'fa' })
  })
  afterEach(() => {
    setLocalePending(false)
    useLocaleStore.getState().setLocale('fa')
  })

  it('brand-new user (server locale null, nothing stored) sees the picker before onboarding', async () => {
    verifyWith(null)
    render(<App />)
    expect(await screen.findByRole('radiogroup')).toBeInTheDocument()
    expect(screen.queryByTestId('onboarding')).toBeNull()
    // The IP-country lookup is started as soon as the picker is known to be coming.
    expect(prefetchGeoCountry).toHaveBeenCalled()
  })

  it('existing user with a saved locale (backfilled fa) never sees the picker', async () => {
    verifyWith('fa')
    render(<App />)
    expect(await screen.findByTestId('onboarding')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).toBeNull()
    // …and pays nothing for the geo lookup.
    expect(prefetchGeoCountry).not.toHaveBeenCalled()
  })

  it('a locale already chosen on this device BY THIS ACCOUNT skips the picker even if the server has none yet', async () => {
    localStorage.setItem('luma.locale', 'en')
    localStorage.setItem('luma.locale.chosen_tg_id', '123') // setup.ts mock user id
    verifyWith(null)
    render(<App />)
    expect(await screen.findByTestId('onboarding')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('a choice made by ANOTHER account on the same device does not skip the picker', async () => {
    // Telegram clients share localStorage across accounts; the device-level
    // locale value alone must not count as "this account already chose".
    localStorage.setItem('luma.locale', 'fa')
    localStorage.setItem('luma.locale.chosen_tg_id', '999')
    verifyWith(null)
    render(<App />)
    expect(await screen.findByRole('radiogroup')).toBeInTheDocument()
    expect(screen.queryByTestId('onboarding')).toBeNull()
  })

  it('picker Continue commits the choice and moves on to onboarding', async () => {
    // Persian Telegram client → picker preselects fa, matching the store.
    const tgUser = window.Telegram!.WebApp!.initDataUnsafe.user as { language_code?: string }
    tgUser.language_code = 'fa'
    try {
      verifyWith(null)
      render(<App />)
      const group = await screen.findByRole('radiogroup')
      expect(group).toBeInTheDocument()
      // Continue with the preselected locale: no store change, so no remount —
      // the gating state alone must advance the screen.
      fireEvent.click(screen.getByRole('button', { name: fa.language.continue }))
      expect(await screen.findByTestId('onboarding')).toBeInTheDocument()
      expect(localStorage.getItem('luma.locale')).toBe('fa')
      // Recorded per account so a remount / next launch of THIS account skips the picker.
      expect(localStorage.getItem('luma.locale.chosen_tg_id')).toBe('123')
    } finally {
      delete tgUser.language_code
    }
  })
})
