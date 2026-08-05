import { describe, it, expect } from 'vitest'
import { premiumSendBlocked } from '../src/utils/premium.js'
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
