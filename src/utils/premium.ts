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
