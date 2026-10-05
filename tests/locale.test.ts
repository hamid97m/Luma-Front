import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mapTelegramLang,
  LOCALE_META,
  readStoredLocale,
  writeStoredLocale,
  detectInitialLocale,
  isLocalePending,
  setLocalePending,
  LOCALE_KEY,
  LOCALE_PENDING_KEY,
} from '../src/i18n/locale.js'

describe('locale helpers', () => {
  beforeEach(() => localStorage.clear())
  // setup.ts pins the suite to Persian; restore it so later test files are unaffected.
  afterEach(() => localStorage.setItem(LOCALE_KEY, 'fa'))

  it('mapTelegramLang', () => {
    expect(mapTelegramLang('fa-IR')).toBe('fa')
    expect(mapTelegramLang('fa')).toBe('fa')
    expect(mapTelegramLang('ar')).toBe('ar')
    expect(mapTelegramLang('AR_SA')).toBe('ar')
    expect(mapTelegramLang('de')).toBe('en')
    expect(mapTelegramLang('')).toBe('en')
    expect(mapTelegramLang(null)).toBe('en')
    expect(mapTelegramLang(undefined)).toBe('en')
  })

  it('direction per locale', () => {
    expect(LOCALE_META.fa.dir).toBe('rtl')
    expect(LOCALE_META.ar.dir).toBe('rtl')
    expect(LOCALE_META.en.dir).toBe('ltr')
  })

  it('stored locale round-trips and ignores garbage', () => {
    expect(readStoredLocale()).toBeNull()
    writeStoredLocale('ar')
    expect(readStoredLocale()).toBe('ar')
    localStorage.setItem(LOCALE_KEY, 'de')
    expect(readStoredLocale()).toBeNull()
  })

  it('pending flag round-trips', () => {
    expect(isLocalePending()).toBe(false)
    setLocalePending(true)
    expect(localStorage.getItem(LOCALE_PENDING_KEY)).toBe('1')
    expect(isLocalePending()).toBe(true)
    setLocalePending(false)
    expect(localStorage.getItem(LOCALE_PENDING_KEY)).toBeNull()
    expect(isLocalePending()).toBe(false)
  })

  it('detectInitialLocale prefers storage, then Telegram language_code, then en', () => {
    expect(detectInitialLocale()).toBe('en') // test setup user has no language_code
    ;(window.Telegram!.WebApp!.initDataUnsafe.user as any).language_code = 'fa'
    expect(detectInitialLocale()).toBe('fa')
    writeStoredLocale('ar')
    expect(detectInitialLocale()).toBe('ar')
    delete (window.Telegram!.WebApp!.initDataUnsafe.user as any).language_code
  })
})
