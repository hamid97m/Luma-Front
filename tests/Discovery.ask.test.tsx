import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'

vi.mock('../src/api.js', () => ({
  api: {
    discovery: { feed: vi.fn() },
    swipes: { swipe: vi.fn(() => Promise.resolve({ matched: false })) },
    directChat: { start: vi.fn() },
    premium: { status: vi.fn().mockResolvedValue({ enabled: true, premiumUntil: null, plans: [] }) },
    asks: {
      friends: vi.fn(() => Promise.resolve({ friends: [] })),
      create: vi.fn(),
      get: vi.fn(() => new Promise(() => {})),
      list: vi.fn(() => Promise.resolve({ asks: [] })),
      profile: vi.fn(),
      event: vi.fn(() => Promise.resolve()),
    },
  },
}))

import { api } from '../src/api.js'
import { t } from '../src/i18n.js'
import { Discovery } from '../src/screens/Discovery.js'
import { useAskConfigStore, useAskDecisionStore, useMyAsksStore } from '../src/components/ask/askUtils.js'

const SARA = { id: 'p1', name: 'Amir', age: 28, bio: null, telegramId: 9, photos: ['https://img1'], interests: [], location: null }

const feed = (profiles: unknown[]) =>
  vi.mocked(api.discovery.feed).mockResolvedValue({ profiles, exhausted: false } as never)

describe('Discovery — ask a friend entry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('luma.locale', 'fa')
    useAskConfigStore.setState({ enabled: true })
    useAskDecisionStore.setState({ pending: null })
    useMyAsksStore.setState({ asks: [], loaded: false })
  })
  afterEach(() => vi.useRealTimers())

  it('no entry button when the feature is disabled', async () => {
    useAskConfigStore.setState({ enabled: false })
    feed([SARA])
    render(<Discovery onOpenChat={vi.fn()} />)
    await screen.findByText('Amir')
    expect(screen.queryByRole('button', { name: t.ask.entryAria })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.aria.directChat })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.aria.rewind })).toBeInTheDocument()
  })

  it('entry button opens the sheet for the top card', async () => {
    feed([SARA])
    render(<Discovery onOpenChat={vi.fn()} />)
    await screen.findByText('Amir')
    fireEvent.click(screen.getByTestId('ask-card-pill'))
    expect(await screen.findByText(t.ask.sheetTitle('Amir'))).toBeInTheDocument()
    expect(api.asks.event).toHaveBeenCalledWith(expect.objectContaining({ name: 'ask_entry_tap', props: { source: 'discovery' } }))
    // Her row is pass · ask · like only (design); men keep chat + rewind.
    expect(screen.queryByRole('button', { name: t.aria.directChat })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.aria.rewind })).not.toBeInTheDocument()
  })

  it('after creating an ask she moves on; the profile waits in «منتظر نظر» and she can go back to it', async () => {
    const ASK = { id: 'a1', targetId: 'p1', targetName: 'Amir', targetPhotoUrl: null, question: 'reply', status: 'open', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString(), total: 1, answered: 0, yes: 0, unsure: 0, no: 0 }
    feed([SARA, { ...SARA, id: 'p2', name: 'Reza' }])
    vi.mocked(api.asks.create).mockResolvedValue({ ask: ASK, links: [] } as never)
    vi.mocked(api.asks.list).mockResolvedValue({ asks: [ASK] } as never)
    vi.mocked(api.asks.profile).mockResolvedValue({ profile: { ...SARA, ask: { id: 'a1', status: 'open', answered: 0, total: 1, yes: 0, question: 'reply' } } } as never)
    vi.mocked(api.asks.get).mockResolvedValue({ ...ASK, target: { id: 'p1', name: 'Amir', age: 28, photoUrl: null }, recipients: [] } as never)
    window.Telegram!.WebApp!.showAlert = vi.fn()
    render(<Discovery onOpenChat={vi.fn()} />)
    await screen.findByText('Amir')
    fireEvent.click(screen.getByTestId('ask-card-pill'))
    fireEvent.click(await screen.findByTestId('ask-add-link'))
    fireEvent.click(screen.getByRole('button', { name: t.ask.submit(1) }))
    // Next profile, no swipe recorded for Amir.
    expect(await screen.findByText('Reza')).toBeInTheDocument()
    expect(screen.queryByText('Amir')).not.toBeInTheDocument()
    expect(api.swipes.swipe).not.toHaveBeenCalled()
    // It waits in «منتظر نظر» (Likes tab); going back is the results → decision path.
    await waitFor(() => expect(useMyAsksStore.getState().asks.map((x) => x.id)).toEqual(['a1']))
    act(() => useAskDecisionStore.getState().request({ targetId: 'p1', decision: 'reply', askId: 'a1' }))
    await waitFor(() => expect(api.asks.profile).toHaveBeenCalledWith('a1'))
    expect(await screen.findByTestId('ask-card-badge')).toHaveTextContent(t.ask.badgeWaiting)
  })

  it('a candidate with answers shows the tally badge, which opens results', async () => {
    feed([{ ...SARA, ask: { id: 'a1', status: 'open', answered: 2, total: 3, yes: 2 } }])
    render(<Discovery onOpenChat={vi.fn()} />)
    const badge = await screen.findByTestId('ask-card-badge')
    expect(badge).toHaveTextContent(t.ask.badgeTally(2, 3, t.ask.verdicts.reply.yes))
    fireEvent.click(badge)
    expect(await screen.findByTestId('ask-results')).toBeInTheDocument()
    expect(api.asks.get).toHaveBeenCalledWith('a1')
  })

  it('a results "reply" decision brings that card to the top, then clears', async () => {
    feed([SARA, { ...SARA, id: 'p2', name: 'Reza' }])
    useAskDecisionStore.getState().request({ targetId: 'p2', decision: 'reply' })
    render(<Discovery onOpenChat={vi.fn()} />)
    await screen.findByText('Reza')
    expect(screen.queryByText('Amir')).not.toBeInTheDocument()
    expect(useAskDecisionStore.getState().pending).toBeNull()
  })

  it('a "reply" decision for a set-aside profile loads it to the top (bot DM path)', async () => {
    feed([SARA])
    vi.mocked(api.asks.profile).mockResolvedValue({ profile: { ...SARA, id: 'zzz', name: 'Kian' } } as never)
    useAskDecisionStore.getState().request({ targetId: 'zzz', decision: 'reply', askId: 'a9' })
    render(<Discovery onOpenChat={vi.fn()} />)
    expect(await screen.findByText('Kian')).toBeInTheDocument()
    expect(api.asks.profile).toHaveBeenCalledWith('a9')
    expect(useAskDecisionStore.getState().pending).toBeNull()
  })

  it('a results "pass" decision swipes the card through Discovery and keeps it out of later batches', async () => {
    feed([{ ...SARA, id: 'p0', name: 'Kian' }, SARA, { ...SARA, id: 'p2', name: 'Reza' }])
    render(<Discovery onOpenChat={vi.fn()} />)
    await screen.findByText('Kian')
    act(() => useAskDecisionStore.getState().request({ targetId: 'p1', decision: 'pass' }))
    await waitFor(() => expect(api.swipes.swipe).toHaveBeenCalledWith('p1', 'pass'))
    expect(useAskDecisionStore.getState().pending).toBeNull()
    // Swipe the two remaining cards; the refetch returns p1 again but it must stay filtered.
    feed([SARA, { ...SARA, id: 'p3', name: 'Omid' }])
    fireEvent.click(screen.getByRole('button', { name: t.aria.pass }))
    await screen.findByText('Reza')
    fireEvent.click(screen.getByRole('button', { name: t.aria.pass }))
    expect(await screen.findByText('Omid')).toBeInTheDocument()
    expect(screen.queryByText('Amir')).not.toBeInTheDocument()
  })

  it('badge wording follows the ask question', async () => {
    feed([{ ...SARA, ask: { id: 'a2', status: 'open', answered: 1, total: 2, yes: 1, question: 'date' } }])
    render(<Discovery onOpenChat={vi.fn()} />)
    expect(await screen.findByTestId('ask-card-badge')).toHaveTextContent(t.ask.badgeTally(1, 2, t.ask.verdicts.date.yes))
  })

  it('tooltip shows right away, survives swipes, and goes for good once she taps ask', async () => {
    feed([SARA, { ...SARA, id: 'u2', name: 'Omid' }])
    const { unmount } = render(<Discovery onOpenChat={vi.fn()} />)
    await screen.findByText('Amir')
    expect(screen.getByTestId('ask-tooltip')).toHaveTextContent(t.ask.tooltip('Amir'))
    expect(api.asks.event).toHaveBeenCalledWith({ name: 'ask_tooltip_shown' })
    // A swipe doesn't dismiss it.
    fireEvent.click(screen.getByRole('button', { name: t.aria.pass }))
    expect(await screen.findByText('Omid')).toBeInTheDocument()
    expect(screen.getByTestId('ask-tooltip')).toHaveTextContent(t.ask.tooltip('Omid'))
    // Tapping the labelled pill on the card opens the ask and retires the tooltip.
    fireEvent.click(screen.getByTestId('ask-card-pill'))
    await waitFor(() => expect(screen.queryByTestId('ask-tooltip')).not.toBeInTheDocument())
    unmount()
    feed([SARA])
    render(<Discovery onOpenChat={vi.fn()} />)
    await screen.findByText('Amir')
    expect(screen.queryByTestId('ask-tooltip')).not.toBeInTheDocument()
  })
})
