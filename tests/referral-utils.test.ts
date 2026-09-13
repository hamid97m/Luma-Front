import { describe, it, expect } from 'vitest'
import { fillPercent, stageNumber, grantedCount, newlyGranted, sheetVariant } from '../src/utils/referral.js'
import type { ReferralMilestone, ReferralStatus } from '../src/types.js'

const milestone = (count: number, granted: boolean, over: Partial<ReferralMilestone> = {}): ReferralMilestone => ({
  count,
  rewardType: 'swipes',
  rewardAmount: 20,
  achieved: granted,
  granted,
  ...over,
})

const status = (over: Partial<ReferralStatus> = {}): ReferralStatus => ({
  enabled: true,
  code: 'abc',
  link: 'https://t.me/lumabot?start=ref_abc',
  qualifiedCount: 0,
  totalCount: 0,
  milestones: [],
  ...over,
})

describe('fillPercent', () => {
  it('is 0 below the first tier', () => {
    expect(fillPercent(0)).toBe(0)
    expect(fillPercent(1)).toBe(0)
  })
  it('interpolates between tier 1 and tier 2', () => {
    expect(fillPercent(2)).toBe(25)
  })
  it('is 50 at tier 2 (count=3)', () => {
    expect(fillPercent(3)).toBe(50)
  })
  it('interpolates between tier 2 and tier 3', () => {
    expect(fillPercent(6)).toBe(71)
  })
  it('is 100 at tier 3 (count=10) and beyond', () => {
    expect(fillPercent(10)).toBe(100)
    expect(fillPercent(12)).toBe(100)
  })
})

describe('stageNumber', () => {
  it('stage 1 below the first tier', () => {
    expect(stageNumber(0)).toBe(1)
  })
  it('stage 2 once the first tier is reached, through the second', () => {
    expect(stageNumber(1)).toBe(2)
    expect(stageNumber(2)).toBe(2)
  })
  it('stage 3 once the second tier is reached', () => {
    expect(stageNumber(3)).toBe(3)
    expect(stageNumber(10)).toBe(3)
  })
})

describe('grantedCount', () => {
  it('counts only granted milestones', () => {
    expect(grantedCount([milestone(1, true), milestone(3, true), milestone(10, false)])).toBe(2)
  })
  it('is 0 when nothing is granted', () => {
    expect(grantedCount([milestone(1, false), milestone(3, false), milestone(10, false)])).toBe(0)
  })
})

describe('newlyGranted', () => {
  const milestones = [milestone(1, true), milestone(3, true), milestone(10, false)]

  it('returns the highest-count granted milestone when grantedCount > seenGranted', () => {
    const result = newlyGranted(milestones, 1)
    expect(result?.count).toBe(3)
  })

  it('returns null when the viewer has already seen every granted milestone', () => {
    expect(newlyGranted(milestones, 2)).toBeNull()
  })
})

describe('sheetVariant', () => {
  it('fresh when nothing qualified and nothing granted', () => {
    expect(sheetVariant(status({ qualifiedCount: 0, milestones: [] }), 0)).toBe('fresh')
  })

  it('progress when qualified but no unseen reward', () => {
    const s = status({ qualifiedCount: 2, milestones: [milestone(1, true), milestone(3, false), milestone(10, false)] })
    expect(sheetVariant(s, 1)).toBe('progress')
  })

  it('reward when a milestone was newly granted since last seen', () => {
    const s = status({ qualifiedCount: 3, milestones: [milestone(1, true), milestone(3, true), milestone(10, false)] })
    expect(sheetVariant(s, 1)).toBe('reward')
  })

  it('complete when qualifiedCount reaches 10 and nothing new to show', () => {
    const s = status({
      qualifiedCount: 10,
      milestones: [milestone(1, true), milestone(3, true), milestone(10, true)],
    })
    expect(sheetVariant(s, 3)).toBe('complete')
  })
})
