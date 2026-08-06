import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/api.js', () => ({
  api: { premium: { status: vi.fn(), checkout: vi.fn(), transaction: vi.fn() } },
}))
vi.mock('../src/telegram.js', () => ({
  openInvoice: vi.fn(),
  haptic: { impact: vi.fn(), selection: vi.fn(), notification: vi.fn() },
}))

import { api } from '../src/api.js'
import { openInvoice } from '../src/telegram.js'
import { usePremiumStore } from '../src/store.js'
import { PaywallSheet } from '../src/components/premium/PaywallSheet.js'
import type { PremiumPlan } from '../src/types.js'

const PLANS: PremiumPlan[] = [
  { id: 'p1', title: '1 Month', description: 'Best start', priceStars: 100, discountPercent: null, originalPriceStars: null, durationDays: 30, discountEndsAt: null },
  { id: 'p2', title: '3 Months', description: 'Save more', priceStars: 150, discountPercent: 50, originalPriceStars: 300, durationDays: 90, discountEndsAt: null },
]

describe('PaywallSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePremiumStore.setState({ status: { enabled: true, premiumUntil: null, plans: PLANS } })
    vi.mocked(api.premium.status).mockResolvedValue({ enabled: true, premiumUntil: null, plans: PLANS })
  })

  it('renders nothing when closed', () => {
    const { container } = render(<PaywallSheet open={false} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('lists plans with discount strikethrough and badge', () => {
    render(<PaywallSheet open onClose={() => {}} />)
    expect(screen.getByText('1 Month')).toBeInTheDocument()
    expect(screen.getByText('3 Months')).toBeInTheDocument()
    expect(screen.getByText('-50%')).toBeInTheDocument()
    expect(screen.getByText('⭐300')).toBeInTheDocument() // struck-through original
  })

  it('checkout: opens the invoice and closes after the payment is confirmed', async () => {
    vi.mocked(api.premium.checkout).mockResolvedValue({ transactionId: 'tx1', invoiceLink: 'https://t.me/i' })
    vi.mocked(openInvoice).mockResolvedValue('paid')
    vi.mocked(api.premium.transaction).mockResolvedValue({ status: 'paid' })
    const onClose = vi.fn()
    render(<PaywallSheet open onClose={onClose} />)

    await userEvent.click(screen.getByText('1 Month'))
    await userEvent.click(screen.getByRole('button', { name: /Continue/ }))

    expect(api.premium.checkout).toHaveBeenCalledWith('p1')
    await waitFor(() => expect(openInvoice).toHaveBeenCalledWith('https://t.me/i'))
    await waitFor(() => expect(api.premium.transaction).toHaveBeenCalledWith('tx1'), { timeout: 4000 })
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 4000 })
    expect(api.premium.status).toHaveBeenCalled() // store refreshed
  })

  it('shows the refunded state when activation fails server-side', async () => {
    vi.mocked(api.premium.checkout).mockResolvedValue({ transactionId: 'tx1', invoiceLink: 'https://t.me/i' })
    vi.mocked(openInvoice).mockResolvedValue('paid')
    vi.mocked(api.premium.transaction).mockResolvedValue({ status: 'refunded' })
    render(<PaywallSheet open onClose={() => {}} />)

    await userEvent.click(screen.getByText('1 Month'))
    await userEvent.click(screen.getByRole('button', { name: /Continue/ }))
    await waitFor(() => expect(screen.getByText(/refunded/i)).toBeInTheDocument(), { timeout: 4000 })
  })

  it('does not close a reopened session when a stale paid-poll refresh resolves late', async () => {
    vi.mocked(api.premium.checkout).mockResolvedValue({ transactionId: 'tx1', invoiceLink: 'https://t.me/i' })
    vi.mocked(openInvoice).mockResolvedValue('paid')
    vi.mocked(api.premium.transaction).mockResolvedValue({ status: 'paid' })

    // First call (initial mount refresh) resolves immediately; every call after
    // that (the poll's post-'paid' refresh, and the reopen's own refresh) hangs
    // until resolved manually — each gets its own resolver (keyed by call
    // index) so resolving the stale poll's refresh can't accidentally resolve
    // the reopen's unrelated refresh instead.
    const resolvers: Array<(v: { enabled: boolean; premiumUntil: string | null; plans: typeof PLANS }) => void> = []
    let statusCallCount = 0
    vi.mocked(api.premium.status).mockImplementation(() => {
      statusCallCount += 1
      if (statusCallCount === 1) {
        return Promise.resolve({ enabled: true, premiumUntil: null, plans: PLANS })
      }
      return new Promise((resolve) => { resolvers[statusCallCount] = resolve })
    })

    const onClose = vi.fn()
    const { rerender } = render(<PaywallSheet open onClose={onClose} />)

    await userEvent.click(screen.getByText('1 Month'))
    await userEvent.click(screen.getByRole('button', { name: /Continue/ }))

    await waitFor(() => expect(openInvoice).toHaveBeenCalledWith('https://t.me/i'))
    await waitFor(() => expect(api.premium.transaction).toHaveBeenCalledWith('tx1'), { timeout: 4000 })
    // Poll saw 'paid' and is now awaiting the (deferred) post-paid refresh.
    await waitFor(() => expect(statusCallCount).toBeGreaterThanOrEqual(2), { timeout: 4000 })

    // Capture the resolver for the stale (session-1) poll's refresh before
    // reopening triggers its own, unrelated refresh call.
    const resolveStalePollRefresh = resolvers[2]

    // Simulate the user closing and reopening the sheet while that refresh is
    // still pending — this bumps the internal session guard.
    rerender(<PaywallSheet open={false} onClose={onClose} />)
    rerender(<PaywallSheet open onClose={onClose} />)

    // Now let the stale (session-1) refresh resolve — NOT the reopen's own
    // refresh call, which is left pending and irrelevant to this assertion.
    resolveStalePollRefresh({ enabled: true, premiumUntil: null, plans: PLANS })

    // Give the stale continuation a chance to run. It must bail on the
    // post-refresh session check instead of closing the newer session.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('PaywallSheet discount countdown', () => {
  // Fake timers scoped to this describe block only — the suite above uses
  // real timers (waitFor + userEvent), so we install/uninstall per-test here
  // rather than touching the outer beforeEach.
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const discountedPlan = (overrides: Partial<(typeof PLANS)[number]> = {}) => ({
    id: 'd1',
    title: 'Discounted',
    description: '',
    priceStars: 50,
    discountPercent: 50,
    originalPriceStars: 100,
    durationDays: 30,
    discountEndsAt: new Date(Date.now() + 65_000).toISOString(),
    ...overrides,
  })

  it('renders "Ends in …" for a discounted plan with an end time, and ticks every second', async () => {
    vi.useFakeTimers()
    const plans = [discountedPlan()]
    usePremiumStore.setState({ status: { enabled: true, premiumUntil: null, plans } })
    vi.mocked(api.premium.status).mockResolvedValue({ enabled: true, premiumUntil: null, plans })

    render(<PaywallSheet open onClose={() => {}} />)

    expect(screen.getByText('Ends in 00:01:05')).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(1000)
    expect(screen.getByText('Ends in 00:01:04')).toBeInTheDocument()
  })

  it('shows no timer for a plan without discountEndsAt', () => {
    vi.useFakeTimers()
    const plans = [{ ...PLANS[0], discountEndsAt: null }, discountedPlan({ discountEndsAt: null, discountPercent: null, originalPriceStars: null })]
    usePremiumStore.setState({ status: { enabled: true, premiumUntil: null, plans } })
    vi.mocked(api.premium.status).mockResolvedValue({ enabled: true, premiumUntil: null, plans })

    render(<PaywallSheet open onClose={() => {}} />)

    expect(screen.queryByText(/Ends in/)).not.toBeInTheDocument()
  })

  it('calls store refresh exactly once when a shown countdown crosses zero', async () => {
    vi.useFakeTimers()
    const plans = [discountedPlan({ discountEndsAt: new Date(Date.now() + 2_000).toISOString() })]
    usePremiumStore.setState({ status: { enabled: true, premiumUntil: null, plans } })
    vi.mocked(api.premium.status).mockResolvedValue({ enabled: true, premiumUntil: null, plans })

    render(<PaywallSheet open onClose={() => {}} />)

    // Initial mount-on-open refresh (existing behavior).
    expect(api.premium.status).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(3_000)
    expect(api.premium.status).toHaveBeenCalledTimes(2)

    // Further ticks must not fire additional refreshes.
    await vi.advanceTimersByTimeAsync(3_000)
    expect(api.premium.status).toHaveBeenCalledTimes(2)
  })
})
