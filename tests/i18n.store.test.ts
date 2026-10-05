import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useLocaleStore, t, applyDocumentLocale } from '../src/i18n.js'
import { fa } from '../src/locales/fa.js'
import { en } from '../src/locales/en.js'
import { ar } from '../src/locales/ar.js'

describe('locale store + t proxy', () => {
  beforeEach(() => {
    localStorage.clear()
    useLocaleStore.getState().setLocale('fa')
  })
  afterEach(() => useLocaleStore.getState().setLocale('fa'))

  it('t reads from the active locale', () => {
    expect(t.settings.title).toBe(fa.settings.title)
    expect(t.match.message('Sara')).toBe(fa.match.message('Sara'))
  })

  it('t is a live view: it follows the store, not a snapshot', () => {
    useLocaleStore.getState().setLocale('en')
    expect(t.settings.title).toBe(en.settings.title)
    expect(t.match.message('Sara')).toBe(en.match.message('Sara'))

    useLocaleStore.getState().setLocale('ar')
    expect(t.settings.title).toBe(ar.settings.title)
    expect(t.match.message('Sara')).toBe(ar.match.message('Sara'))

    useLocaleStore.getState().setLocale('fa')
    expect(t.settings.title).toBe(fa.settings.title)
    expect(Object.keys(t)).toEqual(Object.keys(fa))
    expect('settings' in t).toBe(true)
  })

  it('setLocale persists and flips document dir/lang', () => {
    useLocaleStore.getState().setLocale('en')
    expect(useLocaleStore.getState().locale).toBe('en')
    expect(localStorage.getItem('luma.locale')).toBe('en')
    expect(document.documentElement.getAttribute('dir')).toBe('ltr')
    expect(document.documentElement.getAttribute('lang')).toBe('en')
    applyDocumentLocale('ar')
    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
    expect(document.documentElement.getAttribute('lang')).toBe('ar')
  })

  it('initial document lang/dir follows the pinned test locale (fa)', () => {
    expect(document.documentElement.getAttribute('lang')).toBe('fa')
    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
  })
})
