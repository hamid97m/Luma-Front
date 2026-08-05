import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/api.js', () => ({
  api: {
    auth: { verify: vi.fn() },
    profile: { get: vi.fn(), update: vi.fn(), delete: vi.fn() },
    photos: { getUploadUrl: vi.fn(), delete: vi.fn(), reorder: vi.fn(), uploadFile: vi.fn(), upload: vi.fn() },
    discovery: { feed: vi.fn() },
    swipes: { swipe: vi.fn() },
    matches: { list: vi.fn() },
    premium: { status: vi.fn(), checkout: vi.fn(), transaction: vi.fn() },
  },
}))
vi.mock('../src/telegram.js', () => ({
  openInvoice: vi.fn(),
  haptic: { impact: vi.fn(), selection: vi.fn(), notification: vi.fn() },
}))

import { api } from '../src/api.js'
import { openInvoice, haptic } from '../src/telegram.js'
import { usePremiumStore } from '../src/store.js'
import { PremiumCard } from '../src/components/premium/PremiumCard.js'
import { MyProfile } from '../src/screens/MyProfile.js'

const DAY_MS = 86_400_000

describe('PremiumCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePremiumStore.setState({ status: null })
  })

  it('renders nothing when status is null', () => {
    const { container } = render(<PremiumCard />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when toggle is off and the user is not premium', () => {
    usePremiumStore.setState({ status: { enabled: false, premiumUntil: null, plans: [] } })
    const { container } = render(<PremiumCard />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the remaining day count (plural) when premium is active', () => {
    const until = new Date(Date.now() + 3.5 * DAY_MS).toISOString()
    usePremiumStore.setState({ status: { enabled: false, premiumUntil: until, plans: [] } })
    render(<PremiumCard />)

    expect(screen.getByText('4 days left')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('shows "Ends today" when less than a day remains', () => {
    const until = new Date(Date.now() + 5 * 3600 * 1000).toISOString()
    usePremiumStore.setState({ status: { enabled: false, premiumUntil: until, plans: [] } })
    render(<PremiumCard />)

    expect(screen.getByText('Ends today')).toBeInTheDocument()
    expect(screen.queryByText(/days left/)).not.toBeInTheDocument()
  })

  it('shows the upsell pitch and Get Premium button when not premium and enabled', () => {
    usePremiumStore.setState({ status: { enabled: true, premiumUntil: null, plans: [] } })
    render(<PremiumCard />)

    expect(screen.getByRole('button', { name: 'Get Premium' })).toBeInTheDocument()
  })

  it('opens the paywall sheet when Get Premium is tapped', async () => {
    usePremiumStore.setState({ status: { enabled: true, premiumUntil: null, plans: [] } })
    vi.mocked(api.premium.status).mockResolvedValue({ enabled: true, premiumUntil: null, plans: [] })
    render(<PremiumCard />)

    await userEvent.click(screen.getByRole('button', { name: 'Get Premium' }))

    await waitFor(() => expect(screen.getByText('Luma Premium')).toBeInTheDocument())
  })

  it('an active subscriber still sees the card even when the global toggle is off', () => {
    const until = new Date(Date.now() + 2 * DAY_MS).toISOString()
    usePremiumStore.setState({ status: { enabled: false, premiumUntil: until, plans: [] } })
    render(<PremiumCard />)

    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('completes a purchase without dropping the success feedback when the card flips to Active mid-flight', async () => {
    // Regression for: PaywallSheet used to be nested inside the state-2 (upsell)
    // branch, so the post-purchase store refresh (which flips content to the
    // state-1 Active branch) unmounted the sheet before its mountedRef-guarded
    // success path (haptic + handleClose) could run.
    const plan = { id: 'p1', title: '1 Month', description: '', priceStars: 100, discountPercent: null, originalPriceStars: null, durationDays: 30 }
    const initialStatus = { enabled: true, premiumUntil: null, plans: [plan] }
    const activeUntil = new Date(Date.now() + 30 * DAY_MS).toISOString()
    const activeStatus = { enabled: true, premiumUntil: activeUntil, plans: [plan] }

    usePremiumStore.setState({ status: initialStatus })
    vi.mocked(api.premium.status)
      .mockResolvedValueOnce(initialStatus) // sheet's open-effect refresh
      .mockResolvedValue(activeStatus) // post-'paid' refresh
    vi.mocked(api.premium.checkout).mockResolvedValue({ transactionId: 'tx1', invoiceLink: 'https://t.me/i' })
    vi.mocked(openInvoice).mockResolvedValue('paid')
    vi.mocked(api.premium.transaction).mockResolvedValue({ status: 'paid' })

    render(<PremiumCard />)

    await userEvent.click(screen.getByRole('button', { name: 'Get Premium' }))
    await waitFor(() => expect(screen.getByText('Luma Premium')).toBeInTheDocument())

    await userEvent.click(screen.getByText('1 Month'))
    await userEvent.click(screen.getByRole('button', { name: /Continue/ }))

    await waitFor(() => expect(openInvoice).toHaveBeenCalledWith('https://t.me/i'))
    await waitFor(() => expect(api.premium.transaction).toHaveBeenCalledWith('tx1'), { timeout: 4000 })

    // The card must flip to the Active state...
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument(), { timeout: 4000 })
    // ...and the sheet must have survived long enough to fire its success haptic and close itself.
    expect(haptic.notification).toHaveBeenCalledWith('success')
    await waitFor(() => expect(screen.queryByText('Luma Premium')).not.toBeInTheDocument(), { timeout: 4000 })
  })
})

describe('MyProfile premium card smoke test', () => {
  const PROFILE = {
    id: 'u1', name: 'Ali', age: 25, gender: 'man' as const, looking_for: 'women' as const,
    bio: null, interests: [], location: null,
    icebreaker_prompt: null, icebreaker_answer: null,
    is_active: true, photos: [], setupComplete: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    usePremiumStore.setState({ status: null })
  })

  it('shows the premium card when the store has an active premium status', async () => {
    vi.mocked(api.profile.get).mockResolvedValue(PROFILE as any)
    const until = new Date(Date.now() + 2 * DAY_MS).toISOString()
    usePremiumStore.setState({ status: { enabled: false, premiumUntil: until, plans: [] } })

    render(<MyProfile onOpenSupport={vi.fn()} />)

    await waitFor(() => screen.getByText('My Profile 👤'))
    expect(screen.getByText('Active')).toBeInTheDocument()
  })
})
