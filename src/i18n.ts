import { create } from 'zustand'
import { fa } from './locales/fa.js'
import { en } from './locales/en.js'
import { LOCALE_META, detectInitialLocale, writeStoredLocale, type Locale } from './i18n/locale.js'

export type Messages = typeof fa

// TODO(Task 9b): replace the `ar: fa` alias with the real `ar` locale once locales/ar.ts lands.
const messages: Record<Locale, Messages> = { fa, en, ar: fa }

export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  el.setAttribute('lang', locale)
  el.setAttribute('dir', LOCALE_META[locale].dir)
}

interface LocaleState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: detectInitialLocale(),
  setLocale: (locale) => {
    writeStoredLocale(locale)
    applyDocumentLocale(locale)
    set({ locale })
  },
}))

// Set lang/dir before first paint so the splash doesn't flash the wrong direction.
applyDocumentLocale(useLocaleStore.getState().locale)

const active = (): Messages => messages[useLocaleStore.getState().locale]

/** Live accessor over the active locale. Existing `t.section.key` and
 * `t.section.fn(arg)` call sites keep working unchanged; the App remounts on
 * locale change (main.tsx) so rendered text refreshes. */
export const t: Messages = new Proxy({} as Messages, {
  get: (_target, key) => active()[key as keyof Messages],
  has: (_target, key) => key in active(),
  ownKeys: () => Reflect.ownKeys(active()),
  getOwnPropertyDescriptor: (_target, key) => {
    const desc = Reflect.getOwnPropertyDescriptor(active(), key)
    // Proxy invariant: a descriptor reported for a non-existent target key must be configurable.
    return desc ? { ...desc, configurable: true } : undefined
  },
})

export { type Locale, LOCALES, LOCALE_META } from './i18n/locale.js'
