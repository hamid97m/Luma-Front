import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  LOCALE_META,
  LOCALE_CHOSEN_KEY,
  clearStoredLocale,
  isLocaleChosenHere,
  mapCountryToLocale,
  markLocaleChosen,
  pickDefaultLocale,
  setLocalePending,
  writeStoredLocale,
} from '../src/i18n/locale.js'
import { geoCountrySync, prefetchGeoCountry, resetGeoForTests } from '../src/i18n/geo.js'

describe('first-open default locale', () => {
  it('every locale has a flag', () => {
    expect(LOCALE_META.fa.flag).toBe('🇮🇷')
    expect(LOCALE_META.ar.flag).toBe('🇸🇦')
    expect(LOCALE_META.en.flag).toBe('🇬🇧')
  })

  it('mapCountryToLocale', () => {
    expect(mapCountryToLocale('IR')).toBe('fa')
    expect(mapCountryToLocale('af')).toBe('fa')
    expect(mapCountryToLocale('SA')).toBe('ar')
    expect(mapCountryToLocale('EG')).toBe('ar')
    expect(mapCountryToLocale('DE')).toBeNull()
    expect(mapCountryToLocale('')).toBeNull()
    expect(mapCountryToLocale(null)).toBeNull()
    expect(mapCountryToLocale(undefined)).toBeNull()
  })

  it('Telegram decides when Persian/Arabic, else the country, else English', () => {
    expect(pickDefaultLocale('fa', 'US')).toBe('fa')
    expect(pickDefaultLocale('ar-SA', 'IR')).toBe('ar')
    expect(pickDefaultLocale('en', 'IR')).toBe('fa')
    expect(pickDefaultLocale('en', 'AE')).toBe('ar')
    expect(pickDefaultLocale(undefined, 'IR')).toBe('fa')
    expect(pickDefaultLocale('de', 'DE')).toBe('en')
    expect(pickDefaultLocale('en', null)).toBe('en')
    expect(pickDefaultLocale(null, null)).toBe('en')
  })
})

describe('per-account "chosen" flag', () => {
  const tgUser = () => window.Telegram!.WebApp!.initDataUnsafe.user as { id: number }
  afterEach(() => {
    tgUser().id = 123
    localStorage.clear()
    localStorage.setItem('luma.locale', 'fa') // setup.ts pin
  })

  it('is keyed by the current Telegram user id', () => {
    expect(isLocaleChosenHere()).toBe(false)
    markLocaleChosen()
    expect(localStorage.getItem(LOCALE_CHOSEN_KEY)).toBe('123')
    expect(isLocaleChosenHere()).toBe(true)
    // Another account on the same client: not chosen for them.
    tgUser().id = 999
    expect(isLocaleChosenHere()).toBe(false)
  })

  it('clearStoredLocale forgets value, pending flag and chosen marker', () => {
    writeStoredLocale('ar')
    setLocalePending(true)
    markLocaleChosen()
    clearStoredLocale()
    expect(localStorage.getItem('luma.locale')).toBeNull()
    expect(localStorage.getItem('luma.locale.pending')).toBeNull()
    expect(localStorage.getItem(LOCALE_CHOSEN_KEY)).toBeNull()
  })
})

describe('geo country lookup', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    resetGeoForTests()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    resetGeoForTests()
  })

  const jsonResponse = (body: unknown, ok = true) =>
    Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response)

  it('reads /api/geo once, memoises, and exposes the result synchronously', async () => {
    fetchMock.mockReturnValue(jsonResponse({ country: 'IR' }))
    expect(geoCountrySync()).toBeUndefined()
    const [a, b] = await Promise.all([prefetchGeoCountry(), prefetchGeoCountry()])
    expect(a).toBe('IR')
    expect(b).toBe('IR')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/geo')
    expect(geoCountrySync()).toBe('IR')
  })

  it('treats a non-OK response, garbage, or a network error as unknown', async () => {
    fetchMock.mockReturnValue(jsonResponse({ country: 'IR' }, false))
    expect(await prefetchGeoCountry()).toBeNull()

    resetGeoForTests()
    fetchMock.mockReturnValue(jsonResponse({ country: '<html>' }))
    expect(await prefetchGeoCountry()).toBeNull()

    resetGeoForTests()
    fetchMock.mockRejectedValue(new TypeError('offline'))
    expect(await prefetchGeoCountry()).toBeNull()
    expect(geoCountrySync()).toBeNull()
  })
})
