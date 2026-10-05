import { t, useLocaleStore, LOCALE_META } from '../i18n.js'

// Per-locale Intl tag — fa keeps the Jalali calendar; all three force Latin
// digits (the `-u-nu-latn` extension) per the app-wide digits rule.
const tag = () => LOCALE_META[useLocaleStore.getState().locale].intl

export const formatTime = (d: Date): string =>
  d.toLocaleTimeString(tag(), { hour: '2-digit', minute: '2-digit' })

export const formatShortDate = (d: Date): string =>
  d.toLocaleDateString(tag(), { month: 'short', day: 'numeric' })

export const formatLongDate = (d: Date): string =>
  d.toLocaleDateString(tag(), { month: 'long', day: 'numeric' })

/** Full date with year — used where the date can cross a year boundary
 * (e.g. the "premium until" date on 90-day plans). */
export const formatFullDate = (d: Date): string =>
  d.toLocaleDateString(tag(), { year: 'numeric', month: 'long', day: 'numeric' })

/** Relative time ("Liked you {when}", match list timestamps, …) — words come
 * from t.time. Thresholds ported exactly from the former LikerProfileSheet.likedAgo. */
export const relativeTime = (iso: string): string => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return t.time.justNow
  const m = Math.floor(s / 60)
  if (m < 60) return t.time.minutesAgo(m)
  const h = Math.floor(m / 60)
  if (h < 24) return t.time.hoursAgo(h)
  const d = Math.floor(h / 24)
  if (d === 1) return t.time.yesterday
  if (d < 7) return t.time.daysAgo(d)
  const w = Math.floor(d / 7)
  if (w < 5) return t.time.weeksAgo(w)
  return t.time.monthsAgo(Math.floor(d / 30))
}
