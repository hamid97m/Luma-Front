import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('../src/api.js', () => ({
  api: {
    likes: { list: vi.fn(() => Promise.resolve({ visible: [], locked: [] })) },
    swipes: { swipe: vi.fn(() => Promise.resolve({ matched: false })) },
    premium: { status: vi.fn().mockResolvedValue({ enabled: true, premiumUntil: null, plans: [] }) },
    asks: {
      list: vi.fn(),
      get: vi.fn(),
      remind: vi.fn(() => Promise.resolve({ ok: true })),
      event: vi.fn(() => Promise.resolve()),
    },
  },
}))

import { api } from '../src/api.js'
import { t } from '../src/i18n.js'
import { Likes } from '../src/screens/Likes.js'
import { useAskConfigStore, useMyAsksStore } from '../src/components/ask/askUtils.js'

const soon = new Date(Date.now() + 40 * 3_600_000).toISOString()
const ASK = { id: 'a1', targetId: 'u1', targetName: 'Amir', targetPhotoUrl: null, question: 'reply', status: 'open', createdAt: new Date().toISOString(), expiresAt: soon, total: 3, answered: 2, yes: 2, unsure: 0, no: 0 }
const DETAIL = {
  ...ASK,
  target: { id: 'u1', name: 'Amir', age: 28, photoUrl: null },
  recipients: [
    { id: 'r1', kind: 'member', displayName: 'Sara', status: 'answered', verdict: 'yes', note: 'bio is nice', answeredAt: new Date().toISOString(), canRemind: false, foreignOpen: false },
    { id: 'r2', kind: 'member', displayName: 'Negar', status: 'answered', verdict: 'yes', note: null, answeredAt: new Date(Date.now() - 3_600_000).toISOString(), canRemind: false, foreignOpen: false },
    { id: 'r3', kind: 'link', displayName: 'Maryam', status: 'unseen', verdict: null, note: null, answeredAt: null, canRemind: true, foreignOpen: false },
  ],
}

describe('Likes — «منتظر نظر» for women with ask-a-friend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('luma.locale', 'fa')
    useMyAsksStore.setState({ asks: [], loaded: false })
    vi.mocked(api.asks.list).mockResolvedValue({ asks: [ASK] } as never)
    vi.mocked(api.asks.get).mockResolvedValue(DETAIL as never)
  })

  it('men (feature off) see no segment switch', async () => {
    useAskConfigStore.setState({ enabled: false })
    render(<Likes onOpenChat={vi.fn()} />)
    await screen.findByText(t.likes.empty)
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('lists set-aside profiles with friends\' answers; like decides there, tap opens results', async () => {
    useAskConfigStore.setState({ enabled: true })
    const onOpen = vi.fn()
    render(<Likes onOpenChat={vi.fn()} onOpenAskResults={onOpen} />)
    fireEvent.click(await screen.findByRole('tab', { name: t.likes.segmentAsks(1) }))
    const item = await screen.findByTestId('ask-waiting-item')
    await waitFor(() => expect(item).toHaveTextContent('Amir، 28'))
    expect(item).toHaveTextContent(t.ask.badgeTally(2, 3, t.ask.verdicts.reply.yes))
    expect(item).toHaveTextContent('Sara: «bio is nice»')
    expect(item).toHaveTextContent(t.ask.notYet('Maryam'))
    fireEvent.click(item)
    expect(onOpen).toHaveBeenCalledWith('a1')
    fireEvent.click(screen.getByRole('button', { name: t.aria.like }))
    await waitFor(() => expect(api.swipes.swipe).toHaveBeenCalledWith('u1', 'like'))
    await waitFor(() => expect(screen.queryByTestId('ask-waiting-item')).not.toBeInTheDocument())
  })
})
