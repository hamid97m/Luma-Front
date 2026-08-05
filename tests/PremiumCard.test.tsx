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
