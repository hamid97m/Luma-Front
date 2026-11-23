import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('../src/api.js', () => ({
  api: {
    asks: {
      get: vi.fn(),
      remind: vi.fn(),
      event: vi.fn(() => Promise.resolve()),
    },
  },
}))
vi.mock('../src/telegram.js', () => ({
  haptic: { impact: vi.fn(), selection: vi.fn(), notification: vi.fn() },
  useBackButton: vi.fn(),
  needsInPageBack: () => false,
}))

import { api } from '../src/api.js'
import { t } from '../src/i18n.js'
import { AskResults } from '../src/screens/AskResults.js'
import type { AskDetail } from '../src/types.js'

const now = new Date().toISOString()
const DETAIL: AskDetail = {
  id: 'ask-1', targetId: 't1', targetName: 'Amir', targetPhotoUrl: null, question: 'reply', status: 'open',
  createdAt: now, expiresAt: now, total: 3, answered: 2, yes: 2, unsure: 0, no: 0,
  target: { id: 't1', name: 'Amir', age: 28, photoUrl: null },
  recipients: [
    { id: 'r1', kind: 'member', displayName: 'Sara', status: 'answered', verdict: 'yes', note: 'Nice bio', answeredAt: now, canRemind: false, foreignOpen: false },
    { id: 'r2', kind: 'link', displayName: 'Negar', status: 'answered', verdict: 'yes', note: null, answeredAt: now, canRemind: false, foreignOpen: true },
    { id: 'r3', kind: 'link', displayName: null, status: 'unseen', verdict: null, note: null, answeredAt: null, canRemind: true, foreignOpen: false },
  ],
}

const renderResults = (props: Partial<Parameters<typeof AskResults>[0]> = {}) =>
  render(<AskResults askId="ask-1" onClose={vi.fn()} onReply={vi.fn()} onPass={vi.fn()} {...props} />)

describe('AskResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.Telegram!.WebApp!.showAlert = vi.fn()
  })

  it('shows title, badge, tally, answer cards and pending friends', async () => {
    vi.mocked(api.asks.get).mockResolvedValue(DETAIL)
    renderResults()
    expect(await screen.findByText(t.ask.resultsTitle('Amir'))).toBeInTheDocument()
    expect(api.asks.get).toHaveBeenCalledWith('ask-1')
    expect(screen.getByTestId('ask-results-badge')).toHaveTextContent(t.ask.badgeTally(2, 3, t.ask.verdicts.reply.yes))
    expect(screen.getByTestId('ask-tally-yes')).toHaveTextContent('2')
    expect(screen.getByTestId('ask-tally-no')).toHaveTextContent('0')
    expect(screen.getAllByTestId('ask-answer-card')).toHaveLength(2)
    expect(screen.getByText('Nice bio')).toBeInTheDocument()
    expect(screen.getByText(t.ask.foreignOpen)).toBeInTheDocument()
    expect(screen.getByText(t.ask.pendingUnseen)).toBeInTheDocument()
    expect(screen.getByText(t.ask.resultsPrivacy('Amir'))).toBeInTheDocument()
    expect(api.asks.event).toHaveBeenCalledWith(expect.objectContaining({ name: 'ask_result_viewed', props: { answers_count: 2 } }))
  })

  it('remind calls the endpoint once and then disables', async () => {
    vi.mocked(api.asks.get).mockResolvedValue(DETAIL)
    vi.mocked(api.asks.remind).mockResolvedValue({ ok: true })
    renderResults()
    fireEvent.click(await screen.findByRole('button', { name: t.ask.remind }))
    await waitFor(() => expect(api.asks.remind).toHaveBeenCalledWith('ask-1', 'r3'))
    expect(await screen.findByRole('button', { name: t.ask.reminded })).toBeDisabled()
  })

  it('remind is disabled when canRemind is false', async () => {
    vi.mocked(api.asks.get).mockResolvedValue({
      ...DETAIL,
      recipients: [{ ...DETAIL.recipients[2], status: 'seen', canRemind: false }],
    })
    renderResults()
    expect(await screen.findByText(t.ask.pendingSeen)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.ask.remind })).toBeDisabled()
  })

  it('reply / pass footer hands the detail back', async () => {
    vi.mocked(api.asks.get).mockResolvedValue(DETAIL)
    const onReply = vi.fn()
    const onPass = vi.fn()
    renderResults({ onReply, onPass })
    fireEvent.click(await screen.findByRole('button', { name: t.ask.replyCta('Amir') }))
    expect(onReply).toHaveBeenCalledWith(expect.objectContaining({ id: 'ask-1' }))
    fireEvent.click(screen.getByRole('button', { name: t.ask.passAria }))
    expect(onPass).toHaveBeenCalled()
  })

  it('a closed ask hides the decision footer and remind buttons', async () => {
    vi.mocked(api.asks.get).mockResolvedValue({ ...DETAIL, status: 'closed' })
    renderResults()
    expect(await screen.findByText(t.ask.closedNote)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.ask.replyCta('Amir') })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.ask.remind })).not.toBeInTheDocument()
  })

  it('a failed load shows the ended state', async () => {
    vi.mocked(api.asks.get).mockRejectedValue(Object.assign(new Error('nope'), { status: 404 }))
    renderResults()
    expect(await screen.findByText(t.ask.closed)).toBeInTheDocument()
  })
})
