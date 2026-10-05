export type Locale = 'fa' | 'en' | 'ar'

export const LOCALES: readonly Locale[] = ['fa', 'en', 'ar']

export const LOCALE_META: Record<Locale, { dir: 'rtl' | 'ltr'; intl: string; nativeName: string }> = {
  fa: { dir: 'rtl', intl: 'fa-IR-u-nu-latn', nativeName: 'فارسی' },
  ar: { dir: 'rtl', intl: 'ar-u-nu-latn', nativeName: 'العربية' },
  en: { dir: 'ltr', intl: 'en-US', nativeName: 'English' },
}

export function isLocale(x: unknown): x is Locale {
  return typeof x === 'string' && (LOCALES as readonly string[]).includes(x)
}

/** Telegram `language_code` → app locale; anything not Persian/Arabic → English. */
export function mapTelegramLang(code: string | null | undefined): Locale {
  const base = (code ?? '').toLowerCase().split(/[-_]/)[0]
  if (base === 'fa') return 'fa'
  if (base === 'ar') return 'ar'
  return 'en'
}

export const LOCALE_KEY = 'luma.locale'
export const LOCALE_PENDING_KEY = 'luma.locale.pending'

export function readStoredLocale(): Locale | null {
  try {
    const v = localStorage.getItem(LOCALE_KEY)
    return isLocale(v) ? v : null
  } catch {
    return null
  }
}

export function writeStoredLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    /* private mode */
  }
}

/** Set when a Settings change failed to reach the server; the next launch re-sends it. */
export function isLocalePending(): boolean {
  try {
    return localStorage.getItem(LOCALE_PENDING_KEY) === '1'
  } catch {
    return false
  }
}

export function setLocalePending(pending: boolean): void {
  try {
    if (pending) localStorage.setItem(LOCALE_PENDING_KEY, '1')
    else localStorage.removeItem(LOCALE_PENDING_KEY)
  } catch {
    /* ignore */
  }
}

/** Startup locale: saved choice → Telegram client language → en. */
export function detectInitialLocale(): Locale {
  const tgLang =
    typeof window !== 'undefined'
      ? window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code
      : undefined
  return readStoredLocale() ?? mapTelegramLang(tgLang)
}
