import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LOCALE_META, mapCountryToLocale, pickDefaultLocale } from '../src/i18n/locale.js'
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
