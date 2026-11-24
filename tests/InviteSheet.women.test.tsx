import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

vi.mock('../src/api.js', () => ({ api: { referrals: { me: vi.fn() }, premium: { status: vi.fn() } } }))
vi.mock('../src/telegram.js', async (orig) => ({
  ...(await orig<typeof import('../src/telegram.js')>()), openTelegramLink: vi.fn(),
}))

import { api } from '../src/api.js'
import { t } from '../src/i18n.js'
import { formatFullDate } from '../src/i18n/format.js'
import { openTelegramLink } from '../src/telegram.js'
import { stageNumber } from '../src/utils/referral.js'
import { useReferralStore } from '../src/store.js'
import { InviteSheet } from '../src/components/referrals/InviteSheet.js'

const LINK = 'https://t.me/LumaBot?start=ref_abc'
const until = new Date(Date.now() + 5 * 86_400_000).toISOString()
const women = (likesReward: object) => ({
  enabled: true, code: 'abc', link: LINK, qualifiedCount: 2, totalCount: 3, milestones: [], likesReward,
})
const W = t.referral.women

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useReferralStore.setState({ status: null, sheetOpen: false })
})

describe('InviteSheet — women', () => {
  it('shows the reward, friends counted and unlock date — no stepper', async () => {
    const status = women({ daysPerFriend: 7, friendsCounted: 2, unlockedUntil: until })
    vi.mocked(api.referrals.me).mockResolvedValue(status as never)
    useReferralStore.setState({ status: status as never, sheetOpen: true })
    render(<InviteSheet />)
    expect(screen.getByText(W.headline(7))).toBeInTheDocument()
    expect(screen.getByText(W.counted(2))).toBeInTheDocument()
    expect(screen.getByText(W.unlockedUntil(formatFullDate(new Date(until))))).toBeInTheDocument()
    expect(screen.getByText(W.footnote)).toBeInTheDocument()
    expect(screen.queryByText(t.referral.stage(1))).not.toBeInTheDocument()
    expect(screen.queryByText(t.referral.progressFresh)).not.toBeInTheDocument()
    expect(localStorage.getItem('luma_referral_granted_seen')).toBeNull()
  })

  it('shares the link with a prefilled text', () => {
    const status = women({ daysPerFriend: 7, friendsCounted: 0, unlockedUntil: null })
    vi.mocked(api.referrals.me).mockResolvedValue(status as never)
    useReferralStore.setState({ status: status as never, sheetOpen: true })
    render(<InviteSheet />)
    fireEvent.click(screen.getByText(W.inviteCta))
    expect(openTelegramLink).toHaveBeenCalledWith(
      `https://t.me/share/url?url=${encodeURIComponent(LINK)}&text=${encodeURIComponent(W.shareText)}`)
  })

  it('opens once the status arrives when it was not loaded yet', async () => {
    vi.mocked(api.referrals.me).mockResolvedValue(women({ daysPerFriend: 7, friendsCounted: 0, unlockedUntil: null }) as never)
    render(<InviteSheet />)
    act(() => useReferralStore.getState().openSheet())
    expect(await screen.findByText(W.headline(7))).toBeInTheDocument()
  })

  it('closes itself when the first load fails', async () => {
    vi.mocked(api.referrals.me).mockRejectedValue(new Error('x'))
    render(<InviteSheet />)
    act(() => useReferralStore.getState().openSheet())
    await waitFor(() => expect(useReferralStore.getState().sheetOpen).toBe(false))
  })

  it('everyone else keeps the milestone sheet', () => {
    const status = { ...women({}), likesReward: null, milestones: [{ count: 1, rewardType: 'swipes', rewardAmount: 20, achieved: true, granted: false }] }
    vi.mocked(api.referrals.me).mockResolvedValue(status as never)
    useReferralStore.setState({ status: status as never, sheetOpen: true })
    render(<InviteSheet />)
    expect(screen.queryByText(W.headline(7))).not.toBeInTheDocument()
    expect(screen.getByText(t.referral.stage(stageNumber(2)))).toBeInTheDocument()
  })
})
