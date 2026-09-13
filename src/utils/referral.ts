import type { ReferralMilestone, ReferralStatus } from '../types.js'

export type SheetVariant = 'fresh' | 'progress' | 'reward' | 'complete'

// Progress-rail math from the design (Luma Invite Sheet): 3 tiers at 1/3/10.
export function fillPercent(qualified: number): number {
  const p = qualified < 1 ? 0 : qualified < 3 ? (qualified - 1) / 2 : qualified < 10 ? 1 + (qualified - 3) / 7 : 2
  return Math.round((p / 2) * 100)
}

export function stageNumber(qualified: number): 1 | 2 | 3 {
  return qualified >= 3 ? 3 : qualified >= 1 ? 2 : 1
}

export function grantedCount(milestones: ReferralMilestone[]): number {
  return milestones.filter((m) => m.granted).length
}

export function newlyGranted(milestones: ReferralMilestone[], seenGranted: number): ReferralMilestone | null {
  const granted = milestones.filter((m) => m.granted)
  if (granted.length <= seenGranted) return null
  return granted.reduce((a, b) => (b.count > a.count ? b : a))
}

export function sheetVariant(status: ReferralStatus, seenGranted: number): SheetVariant {
  if (newlyGranted(status.milestones, seenGranted)) return 'reward'
  if (status.qualifiedCount >= 10) return 'complete'
  if (status.qualifiedCount === 0) return 'fresh'
  return 'progress'
}
