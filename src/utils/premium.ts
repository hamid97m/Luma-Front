import type { Match, PremiumStatus } from '../types.js'

/** Client-side courtesy check — the server 403 is the real enforcement.
 * `match.premiumRequired` is computed at match-fetch time; the live premium
 * status (refreshed after purchase / on launch) can override it in both
 * directions except it never unblocks without data. */
export function premiumSendBlocked(match: Match, status: PremiumStatus | null): boolean {
  if (!match.premiumRequired) return false
  if (!status) return true
  if (!status.enabled) return false
  return !status.premiumUntil || new Date(status.premiumUntil).getTime() <= Date.now()
}

/** Formats a millisecond duration as a countdown string: "X روز HH:MM:SS" once the
 * remaining time reaches 24h, otherwise "HH:MM:SS". Negative/zero clamps to 00:00:00. */
export function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  const hms = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  return days > 0 ? `${days} روز ${hms}` : hms
}
