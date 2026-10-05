export type Locale = 'fa' | 'en' | 'ar'

export const LOCALES: readonly Locale[] = ['fa', 'en', 'ar']

export const LOCALE_META: Record<Locale, { dir: 'rtl' | 'ltr'; intl: string; nativeName: string; flag: string }> = {
  fa: { dir: 'rtl', intl: 'fa-IR-u-nu-latn', nativeName: 'فارسی', flag: '🇮🇷' },
  ar: { dir: 'rtl', intl: 'ar-u-nu-latn', nativeName: 'العربية', flag: '🇸🇦' },
  en: { dir: 'ltr', intl: 'en-US', nativeName: 'English', flag: '🇬🇧' },
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

const PERSIAN_COUNTRIES = new Set(['IR', 'AF'])
const ARABIC_COUNTRIES = new Set([
  'SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'IQ', 'SY', 'JO', 'LB', 'PS', 'YE',
  'EG', 'SD', 'LY', 'TN', 'DZ', 'MA', 'MR', 'SO', 'DJ', 'KM',
])

/** ISO-3166 alpha-2 country → locale, or null when the country implies nothing. */
export function mapCountryToLocale(country: string | null | undefined): Locale | null {
  const c = (country ?? '').toUpperCase()
  if (PERSIAN_COUNTRIES.has(c)) return 'fa'
  if (ARABIC_COUNTRIES.has(c)) return 'ar'
  return null
}

/** First-open default: Telegram's language decides when it is Persian/Arabic;
 * otherwise (English, another language, or missing) the IP country decides;
 * otherwise English. Many Persian/Arabic speakers run Telegram in English,
 * which is why the country gets a say when Telegram is not decisive. */
export function pickDefaultLocale(tgLang: string | null | undefined, country: string | null | undefined): Locale {
  const fromTelegram = mapTelegramLang(tgLang)
  if (fromTelegram !== 'en') return fromTelegram
  return mapCountryToLocale(country) ?? 'en'
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
