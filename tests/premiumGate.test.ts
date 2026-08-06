import { describe, it, expect } from 'vitest'
import { premiumSendBlocked, formatCountdown } from '../src/utils/premium.js'
import type { Match, PremiumStatus } from '../src/types.js'

const match = (premiumRequired?: boolean) => ({ premiumRequired } as Match)
const status = (over: Partial<PremiumStatus>): PremiumStatus =>
  ({ enabled: true, premiumUntil: null, plans: [], ...over })

describe('premiumSendBlocked', () => {
  it('false when the match is not gated', () => {
    expect(premiumSendBlocked(match(false), status({}))).toBe(false)
    expect(premiumSendBlocked(match(undefined), status({}))).toBe(false)
  })
  it('true when gated and no fresher status is known', () => {
    expect(premiumSendBlocked(match(true), null)).toBe(true)
  })
  it('false when the toggle was turned off since the match loaded', () => {
    expect(premiumSendBlocked(match(true), status({ enabled: false }))).toBe(false)
  })
  it('false when premium became active since the match loaded', () => {
    expect(premiumSendBlocked(match(true), status({ premiumUntil: new Date(Date.now() + 60000).toISOString() }))).toBe(false)
  })
  it('true when gated, enabled, and not premium', () => {
    expect(premiumSendBlocked(match(true), status({ premiumUntil: null }))).toBe(true)
    expect(premiumSendBlocked(match(true), status({ premiumUntil: new Date(Date.now() - 1000).toISOString() }))).toBe(true)
  })
})

describe('formatCountdown', () => {
  it('formats under an hour as HH:MM:SS', () => {
    expect(formatCountdown(65 * 1000)).toBe('00:01:05')
  })

  it('formats several hours as HH:MM:SS', () => {
    expect(formatCountdown((5 * 3600 + 3 * 60 + 9) * 1000)).toBe('05:03:09')
  })

  it('formats just under the 24h boundary as HH:MM:SS (no day prefix)', () => {
    expect(formatCountdown(24 * 3600 * 1000 - 1000)).toBe('23:59:59')
  })

  it('formats exactly 24h as "1d 00:00:00"', () => {
    expect(formatCountdown(24 * 3600 * 1000)).toBe('1d 00:00:00')
  })

  it('formats multiple days as "Xd HH:MM:SS"', () => {
    expect(formatCountdown((2 * 86400 + 5 * 3600 + 3 * 60 + 1) * 1000)).toBe('2d 05:03:01')
  })

  it('clamps negative/zero remaining time to 00:00:00', () => {
    expect(formatCountdown(0)).toBe('00:00:00')
    expect(formatCountdown(-5000)).toBe('00:00:00')
  })
})
