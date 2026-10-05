import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('../src/api.js', () => ({
  api: { premium: { status: vi.fn(), checkout: vi.fn(), transaction: vi.fn() } },
}))
vi.mock('../src/telegram.js', () => ({
  openInvoice: vi.fn(),
  haptic: { impact: vi.fn(), selection: vi.fn(), notification: vi.fn() },
  useBackButton: vi.fn(),
}))

import { api } from '../src/api.js'
import { usePremiumStore } from '../src/store.js'
import { useLocaleStore, messagesFor, type Locale } from '../src/i18n.js'
import { PaywallSheet } from '../src/components/premium/PaywallSheet.js'
import type { PremiumPlan } from '../src/types.js'

const PLANS: PremiumPlan[] = [
  { id: 'p1', title: '1 Month', description: '', priceStars: 100, discountPercent: null, originalPriceStars: null, durationDays: 30, discountEndsAt: null },
]

const renderFor = (locale: Locale) => {
  useLocaleStore.getState().setLocale(locale)
  render(<PaywallSheet open onClose={() => {}} />)
}

describe('PaywallSheet locale-specific content', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePremiumStore.setState({ status: { enabled: true, premiumUntil: null, plans: PLANS } })
    vi.mocked(api.premium.status).mockResolvedValue({ enabled: true, premiumUntil: null, plans: PLANS })
  })
  afterEach(() => {
    cleanup()
    useLocaleStore.getState().setLocale('fa')
  })

  it('shows the Iranian "how to buy Stars" guide CTA only for fa', () => {
    renderFor('fa')
    expect(screen.getByText(messagesFor('fa').premium.starsGuideCta)).toBeInTheDocument()
    cleanup()

    renderFor('en')
    expect(screen.queryByText(messagesFor('en').premium.starsGuideCta)).not.toBeInTheDocument()
    cleanup()

    renderFor('ar')
    expect(screen.queryByText(messagesFor('ar').premium.starsGuideCta)).not.toBeInTheDocument()
  })

  it('keeps the "other ways to get Stars" toggle for every locale', () => {
    for (const locale of ['fa', 'en', 'ar'] as const) {
      renderFor(locale)
      expect(screen.getByText(messagesFor(locale).premium.otherWaysToggle)).toBeInTheDocument()
      cleanup()
    }
  })
})
