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
      event: vi.fn(() => Promise.resolve()),
    },
  },
}))

import { api } from '../src/api.js'
import { t } from '../src/i18n.js'
import { Discovery } from '../src/screens/Discovery.js'
import { useAskConfigStore, useAskDecisionStore } from '../src/components/ask/askUtils.js'

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
  })
  afterEach(() => vi.useRealTimers())

  it('no entry button when the feature is disabled', async () => {
    useAskConfigStore.setState({ enabled: false })
    feed([SARA])
    render(<Discovery onOpenChat={vi.fn()} />)
    await screen.findByText('Amir')
    expect(screen.queryByRole('button', { name: t.ask.entryAria })).not.toBeInTheDocument()
  })

  it('entry button opens the sheet for the top card', async () => {
    feed([SARA])
    render(<Discovery onOpenChat={vi.fn()} />)
    await screen.findByText('Amir')
    fireEvent.click(screen.getByRole('button', { name: t.ask.entryAria }))
    expect(await screen.findByText(t.ask.sheetTitle('Amir'))).toBeInTheDocument()
    expect(api.asks.event).toHaveBeenCalledWith(expect.objectContaining({ name: 'ask_entry_tap', props: { source: 'discovery' } }))
  })

  it('after creating an ask the card stays with a "waiting" badge', async () => {
    feed([SARA])
    vi.mocked(api.asks.create).mockResolvedValue({
      ask: { id: 'a1', targetId: 'p1', targetName: 'Amir', targetPhotoUrl: null, question: 'reply', status: 'open', createdAt: '', expiresAt: '', total: 1, answered: 0, yes: 0, unsure: 0, no: 0 },
      links: [],
    })
    window.Telegram!.WebApp!.showAlert = vi.fn()
    render(<Discovery onOpenChat={vi.fn()} />)
    await screen.findByText('Amir')
    fireEvent.click(screen.getByRole('button', { name: t.ask.entryAria }))
    fireEvent.click(await screen.findByTestId('ask-add-link'))
    fireEvent.click(screen.getByRole('button', { name: t.ask.submit(1) }))
    expect(await screen.findByTestId('ask-card-badge')).toHaveTextContent(t.ask.badgeWaiting)
    expect(screen.getByText('Amir')).toBeInTheDocument()
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

  it('a decision whose card is not in the batch is still cleared', async () => {
    feed([SARA])
    useAskDecisionStore.getState().request({ targetId: 'zzz', decision: 'reply' })
    render(<Discovery onOpenChat={vi.fn()} />)
    await screen.findByText('Amir')
    await waitFor(() => expect(useAskDecisionStore.getState().pending).toBeNull())
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

  it('shows the first-time tooltip once after 5 s idle, dismissed on tap', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    feed([SARA])
    render(<Discovery onOpenChat={vi.fn()} />)
    await screen.findByText('Amir')
    expect(screen.queryByTestId('ask-tooltip')).not.toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(5100) })
    expect(screen.getByTestId('ask-tooltip')).toHaveTextContent(t.ask.tooltip('Amir'))
    expect(api.asks.event).toHaveBeenCalledWith({ name: 'ask_tooltip_shown' })
    fireEvent.pointerDown(screen.getByTestId('ask-tooltip'))
    await waitFor(() => expect(screen.queryByTestId('ask-tooltip')).not.toBeInTheDocument())
    // Never again.
    await act(async () => { vi.advanceTimersByTime(6000) })
    expect(screen.queryByTestId('ask-tooltip')).not.toBeInTheDocument()
  })
})
