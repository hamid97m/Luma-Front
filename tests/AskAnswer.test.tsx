import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('../src/api.js', () => ({
  api: {
    asks: {
      forMe: vi.fn(),
      answerForMe: vi.fn(),
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
import { AskAnswer } from '../src/components/ask/AskAnswer.js'
import { AskMember } from '../src/screens/AskMember.js'
import type { AskRecipientView } from '../src/types.js'

const VIEW: AskRecipientView = {
  recipientId: 'rec-1',
  requesterName: 'Sara',
  requesterPhotoUrl: null,
  question: 'reply',
  status: 'open',
  watermark: 'AB12CD',
  isMember: false,
  profile: {
    name: 'Amir', age: 28, location: 'Tehran', bio: 'Weekend hikes', interests: ['Coffee', 'Music'],
    photos: ['https://img/1.jpg', 'https://img/2.jpg'],
  },
  myAnswer: null,
}

describe('AskAnswer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.Telegram!.WebApp!.showAlert = vi.fn()
  })

  it('renders requester, question, profile, watermark and no like/message actions', () => {
    render(<AskAnswer view={VIEW} recipientKind="member" onSubmit={vi.fn()} />)
    expect(screen.getByText(t.ask.wantsYourOpinion('Sara'))).toBeInTheDocument()
    expect(screen.getByText(t.ask.asksQuestion(t.ask.questions.reply))).toBeInTheDocument()
    expect(screen.getByText('Amir')).toBeInTheDocument()
    expect(screen.getByText('Tehran')).toBeInTheDocument()
    expect(screen.getByText('Coffee')).toBeInTheDocument()
    expect(screen.getAllByTestId('ask-watermark')).toHaveLength(2)
    expect(screen.getAllByTestId('ask-watermark')[0]).toHaveTextContent('AB12CD')
    expect(screen.getByText(t.ask.answerPrivacy('Sara', 'Amir'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.aria.like })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.aria.directChat })).not.toBeInTheDocument()
  })

  it('uses the question-specific verdict labels', () => {
    render(<AskAnswer view={{ ...VIEW, question: 'date' }} recipientKind="member" onSubmit={vi.fn()} />)
    expect(screen.getByRole('radio', { name: t.ask.verdicts.date.yes })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: t.ask.verdicts.date.no })).toBeInTheDocument()
  })

  it('submit is disabled until a verdict is picked; sends verdict + trimmed note, then shows thanks with edit', async () => {
    const onSubmit = vi.fn(() => Promise.resolve())
    render(<AskAnswer view={VIEW} recipientKind="member" onSubmit={onSubmit} />)
    const send = screen.getByRole('button', { name: t.ask.sendAnswer })
    expect(send).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: t.ask.verdicts.reply.yes }))
    fireEvent.change(screen.getByPlaceholderText(t.ask.notePlaceholder), { target: { value: '  nice bio  ' } })
    expect(send).toBeEnabled()
    fireEvent.click(send)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('yes', 'nice bio'))
    expect(await screen.findByText(t.ask.thanksTitle('Sara'))).toBeInTheDocument()
    // Editable within the 10-minute window.
    fireEvent.click(screen.getByRole('button', { name: t.ask.editAnswer }))
    expect(screen.getByRole('radio', { name: t.ask.verdicts.reply.yes })).toHaveAttribute('aria-checked', 'true')
  })

  it('caps the note at 300 characters', () => {
    render(<AskAnswer view={VIEW} recipientKind="member" onSubmit={vi.fn()} />)
    const ta = screen.getByPlaceholderText(t.ask.notePlaceholder) as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'x'.repeat(400) } })
    expect(ta.value).toHaveLength(300)
    expect(screen.getByText('300/300')).toBeInTheDocument()
  })

  it('an existing answer past its edit window shows thanks without an edit button', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    render(<AskAnswer view={{ ...VIEW, myAnswer: { verdict: 'no', note: 'meh', answeredAt: past, editableUntil: past } }} recipientKind="link" onSubmit={vi.fn()} />)
    expect(screen.getByText(t.ask.thanksTitle('Sara'))).toBeInTheDocument()
    expect(screen.getByText(t.ask.verdicts.reply.no)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.ask.editAnswer })).not.toBeInTheDocument()
  })

  it('a closed ask shows the ended state', () => {
    render(<AskAnswer view={{ ...VIEW, status: 'expired' }} recipientKind="member" onSubmit={vi.fn()} />)
    expect(screen.getByText(t.ask.closed)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.ask.sendAnswer })).not.toBeInTheDocument()
  })

  it('409 ask_closed on submit flips to the ended state', async () => {
    const onSubmit = vi.fn(() => Promise.reject(Object.assign(new Error('{"error":"ask_closed"}'), { status: 409 })))
    render(<AskAnswer view={VIEW} recipientKind="member" onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole('radio', { name: t.ask.verdicts.reply.unsure }))
    fireEvent.click(screen.getByRole('button', { name: t.ask.sendAnswer }))
    expect(await screen.findByText(t.ask.closed)).toBeInTheDocument()
  })
})

describe('AskMember (?screen=ask&r=)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads the recipient view and answers through the member endpoint', async () => {
    vi.mocked(api.asks.forMe).mockResolvedValue(VIEW)
    vi.mocked(api.asks.answerForMe).mockResolvedValue({ ok: true })
    render(<AskMember recipientId="rec-1" onClose={vi.fn()} />)
    await screen.findByText(t.ask.wantsYourOpinion('Sara'))
    expect(api.asks.forMe).toHaveBeenCalledWith('rec-1')
    fireEvent.click(screen.getByRole('radio', { name: t.ask.verdicts.reply.no }))
    fireEvent.click(screen.getByRole('button', { name: t.ask.sendAnswer }))
    await waitFor(() => expect(api.asks.answerForMe).toHaveBeenCalledWith('rec-1', 'no', undefined))
    expect(await screen.findByText(t.ask.thanksTitle('Sara'))).toBeInTheDocument()
  })

  it('a 404 (not mine / gone) shows the ended state', async () => {
    vi.mocked(api.asks.forMe).mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }))
    render(<AskMember recipientId="rec-x" onClose={vi.fn()} />)
    expect(await screen.findByText(t.ask.closed)).toBeInTheDocument()
  })
})
