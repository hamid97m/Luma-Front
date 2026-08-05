import { describe, it, expect, vi, beforeEach } from 'vitest'
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

const PLANS = [
  { id: 'p1', title: '1 Month', description: 'Best start', priceStars: 100, discountPercent: null, originalPriceStars: null, durationDays: 30 },
  { id: 'p2', title: '3 Months', description: 'Save more', priceStars: 150, discountPercent: 50, originalPriceStars: 300, durationDays: 90 },
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
})
