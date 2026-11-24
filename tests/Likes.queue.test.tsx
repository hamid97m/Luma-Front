import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react'

vi.mock('../src/api.js', () => ({
  api: {
    likes: { list: vi.fn() },
    swipes: { swipe: vi.fn(() => Promise.resolve({ matched: false })) },
    premium: { status: vi.fn().mockResolvedValue({ enabled: true, premiumUntil: null, plans: [] }) },
    referrals: { me: vi.fn(() => Promise.reject(new Error('n/a'))) },
    asks: { list: vi.fn(() => Promise.resolve({ asks: [] })) },
  },
}))
vi.mock('../src/components/premium/PaywallSheet.js', () => ({
  PaywallSheet: ({ open }: { open: boolean }) => (open ? <div data-testid="paywall" /> : null),
}))

import { api } from '../src/api.js'
import { t } from '../src/i18n.js'
import { formatLongDate } from '../src/i18n/format.js'
import { Likes } from '../src/screens/Likes.js'
import { useReferralStore, usePremiumStore } from '../src/store.js'
import { useAskConfigStore } from '../src/components/ask/askUtils.js'

const ALI = {
  id: 'm1', name: 'Ali', age: 30, bio: null, location: null, interests: [], telegramId: 1,
  photos: ['http://p/ali.jpg'], likedAt: new Date().toISOString(), premium: false,
}
const QUEUE = {
  lockedCount: 19, photos: ['http://b/1', 'http://b/2', null, 'http://b/4', 'http://b/5', 'http://b/6'],
  inviteEnabled: true, premiumEnabled: true, daysPerFriend: 7,
}
const REWARD = { daysPerFriend: 7, friendsCounted: 1, unlockedUntil: null }
const base = { visible: [ALI], locked: [], lockedCount: 0, premiumRequired: false }
const respond = (r: object) => vi.mocked(api.likes.list).mockResolvedValue({ ...base, ...r } as never)
const draw = () => render(<Likes onOpenChat={vi.fn()} />)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('luma.locale', 'fa')
  useAskConfigStore.setState({ enabled: false })
  usePremiumStore.setState({ status: null })
  useReferralStore.setState({ status: null, sheetOpen: false })
})

describe('Likes — women\'s locked queue', () => {
  it('shows the free like, the count, 6 blurred tiles and invite-first CTAs', async () => {
    respond({ queue: QUEUE, unlockedUntil: null })
    draw()
    const queue = await screen.findByTestId('likes-queue')
    expect(screen.getByText('Ali, 30')).toBeInTheDocument()
    expect(queue).toHaveTextContent(t.likes.queueTitleMore(19))
    expect(queue).not.toHaveTextContent(t.likes.freeLikeUsed)
    expect(within(queue).getAllByLabelText(t.likes.queueTileAria)).toHaveLength(6)
    expect(queue.querySelectorAll('img')).toHaveLength(5) // the null photo is a gradient
    expect(screen.getByText(t.likes.subtitle(20))).toBeInTheDocument()

    fireEvent.click(screen.getByText(t.likes.queueInviteCta(7)))
    expect(useReferralStore.getState().sheetOpen).toBe(true)
    fireEvent.click(screen.getByText(t.likes.queuePremiumCta))
    expect(screen.getByTestId('paywall')).toBeInTheDocument()
  })

  it('a tile opens the invite sheet, and a broken photo becomes a gradient', async () => {
    respond({ queue: { ...QUEUE, lockedCount: 1, photos: ['http://b/1'] } })
    draw()
    const queue = await screen.findByTestId('likes-queue')
    fireEvent.error(queue.querySelector('img')!)
    expect(queue.querySelector('img')).toBeNull()
    fireEvent.click(within(queue).getByLabelText(t.likes.queueTileAria))
    expect(useReferralStore.getState().sheetOpen).toBe(true)
    expect(screen.queryByTestId('paywall')).not.toBeInTheDocument()
  })

  it('after today\'s like is answered: a note instead of the empty state', async () => {
    respond({ visible: [], queue: QUEUE })
    draw()
    const queue = await screen.findByTestId('likes-queue')
    expect(queue).toHaveTextContent(t.likes.freeLikeUsed)
    expect(queue).toHaveTextContent(t.likes.queueTitle(19))
    expect(screen.queryByText(t.likes.empty)).not.toBeInTheDocument()
  })

  it('invites off: premium is the only way and tiles open the paywall', async () => {
    respond({ queue: { ...QUEUE, inviteEnabled: false } })
    draw()
    const queue = await screen.findByTestId('likes-queue')
    expect(screen.queryByText(t.likes.queueInviteCta(7))).not.toBeInTheDocument()
    fireEvent.click(within(queue).getAllByLabelText(t.likes.queueTileAria)[0])
    expect(screen.getByTestId('paywall')).toBeInTheDocument()
    expect(useReferralStore.getState().sheetOpen).toBe(false)
  })

  it('premium off: no premium button', async () => {
    respond({ queue: { ...QUEUE, premiumEnabled: false } })
    draw()
    await screen.findByTestId('likes-queue')
    expect(screen.queryByText(t.likes.queuePremiumCta)).not.toBeInTheDocument()
  })

  it('unlocked: the chip with the date and a +days invite link, no queue', async () => {
    const until = '2026-12-10T10:00:00.000Z'
    useReferralStore.setState({ status: { enabled: true, code: 'x', link: 'l', qualifiedCount: 1, totalCount: 1, milestones: [], likesReward: REWARD } })
    respond({ queue: null, unlockedUntil: until })
    draw()
    const chip = await screen.findByTestId('likes-unlocked')
    expect(chip).toHaveTextContent(t.likes.unlockedUntil(formatLongDate(new Date(until))))
    expect(screen.queryByTestId('likes-queue')).not.toBeInTheDocument()
    expect(screen.getByText(t.likes.subtitleAllVisible(1))).toBeInTheDocument()
    expect(screen.queryByText(t.likes.free)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(t.likes.unlockedMore(7)))
    expect(useReferralStore.getState().sheetOpen).toBe(true)
  })

  it('reloads when the invite sheet closes and when the app becomes visible', async () => {
    respond({ queue: QUEUE })
    draw()
    await screen.findByTestId('likes-queue')
    expect(api.likes.list).toHaveBeenCalledTimes(1)
    act(() => useReferralStore.getState().openSheet())
    expect(api.likes.list).toHaveBeenCalledTimes(1)
    act(() => useReferralStore.getState().closeSheet())
    await waitFor(() => expect(api.likes.list).toHaveBeenCalledTimes(2))
    respond({ visible: [], queue: null })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await screen.findByText(t.likes.empty)
  })

  it('old backend shape: no queue, no chip', async () => {
    respond({})
    draw()
    expect(await screen.findByText('Ali, 30')).toBeInTheDocument()
    expect(screen.queryByTestId('likes-queue')).not.toBeInTheDocument()
    expect(screen.queryByTestId('likes-unlocked')).not.toBeInTheDocument()
  })

  it('men: locked tiles and banner still open the paywall', async () => {
    respond({ visible: [], locked: [{ photo: 'http://p/w.jpg' }], lockedCount: 1, premiumRequired: true, queue: null, unlockedUntil: null })
    draw()
    expect(await screen.findByText(t.likes.bannerCount(1))).toBeInTheDocument()
    expect(screen.queryByTestId('likes-queue')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(t.likes.premium))
    expect(screen.getByTestId('paywall')).toBeInTheDocument()
  })
})
