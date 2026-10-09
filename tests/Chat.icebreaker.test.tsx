import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

vi.mock('../src/api.js', () => ({
  api: {
    messages: { list: vi.fn(), send: vi.fn(), edit: vi.fn(), delete: vi.fn() },
    premium: { status: vi.fn() },
  },
}))
vi.mock('../src/telegram.js', () => ({
  haptic: { impact: vi.fn(), selection: vi.fn(), notification: vi.fn() },
  useBackButton: vi.fn(),
}))

import { api } from '../src/api.js'
import { t } from '../src/i18n.js'
import { Chat } from '../src/screens/Chat.js'
import type { Match, Message } from '../src/types.js'

const MATCH: Match = {
  id: 'match-1',
  matchedAt: '2026-01-01T00:00:00Z',
  user: {
    id: 'other-1', name: 'Sara', photos: [], telegramId: 99, username: null,
    age: 24, bio: null, icebreakerPrompt: 'جمعه ایده‌آل من…', icebreakerAnswer: 'کوه و بعد صبحانه',
  },
  lastMessage: null,
  unreadCount: 0,
}

const MY_ICEBREAKER: Message = {
  id: 'ib-mine',
  senderId: 'me-1',
  body: 'مهارت عجیب‌وغریبم…',
  icebreakerAnswer: 'سوت زدن با دو انگشت',
  createdAt: '2026-01-01T10:00:00.000Z',
  readAt: null,
  type: 'icebreaker',
}

const THEIR_ICEBREAKER: Message = {
  id: 'ib-theirs',
  senderId: 'other-1',
  body: 'جمعه ایده‌آل من…',
  icebreakerAnswer: 'کوه و بعد صبحانه',
  createdAt: '2026-01-01T10:00:00.001Z',
  readAt: null,
  type: 'icebreaker',
}

const THEIR_QUESTION = 'جمعه ایده‌آل تو چه شکلی است؟'

describe('Chat icebreakers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('tapping Answer puts the composer in reply mode against that icebreaker', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [MY_ICEBREAKER, THEIR_ICEBREAKER] })
    vi.mocked(api.messages.send).mockResolvedValue({
      message: {
        id: 'm3', senderId: 'me-1', body: 'کوه عالیه', createdAt: '2026-01-01T10:05:00Z',
        readAt: null, replyToMessageId: 'ib-theirs', type: 'text',
      },
    })

    render(<Chat match={MATCH} myUserId="me-1" onBack={vi.fn()} />)
    await waitFor(() => screen.getByRole('button', { name: t.chat.answerIt }))

    fireEvent.click(screen.getByRole('button', { name: t.chat.answerIt }))

    // Reply strip quotes the localized question (also on the card itself).
    expect(screen.getByText(t.chat.replyingLabel)).toBeInTheDocument()
    expect(screen.getAllByText(THEIR_QUESTION)).toHaveLength(2)
    const input = screen.getByPlaceholderText(t.chat.placeholder)
    expect(input).toHaveFocus()

    fireEvent.change(input, { target: { value: 'کوه عالیه' } })
    fireEvent.click(screen.getByLabelText(t.chat.send))
    await waitFor(() => expect(api.messages.send).toHaveBeenCalledWith('match-1', 'کوه عالیه', 'ib-theirs'))

    // The sent reply's quote shows the question under the other person's name.
    await waitFor(() => expect(screen.getAllByText(THEIR_QUESTION)).toHaveLength(2))
    expect(within(screen.getByRole('log')).getByText('Sara')).toBeInTheDocument()
  })

  it('hides the Answer button once I have replied to their icebreaker', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({
      messages: [
        MY_ICEBREAKER,
        THEIR_ICEBREAKER,
        {
          id: 'm3', senderId: 'me-1', body: 'کوه عالیه', createdAt: '2026-01-01T10:05:00Z',
          readAt: null, replyToMessageId: 'ib-theirs', type: 'text',
        },
      ],
    })
    render(<Chat match={MATCH} myUserId="me-1" onBack={vi.fn()} />)
    await waitFor(() => screen.getByText('کوه عالیه'))
    expect(screen.getByText(t.chat.icebreakerOf('Sara'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.chat.answerIt })).not.toBeInTheDocument()
  })

  it('keeps the Answer button when their reply quotes my icebreaker', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({
      messages: [
        MY_ICEBREAKER,
        THEIR_ICEBREAKER,
        {
          id: 'm4', senderId: 'other-1', body: 'سوت؟ جدی؟', createdAt: '2026-01-01T10:06:00Z',
          readAt: null, replyToMessageId: 'ib-mine', type: 'text',
        },
      ],
    })
    render(<Chat match={MATCH} myUserId="me-1" onBack={vi.fn()} />)
    await waitFor(() => screen.getByText('سوت؟ جدی؟'))
    expect(screen.getByRole('button', { name: t.chat.answerIt })).toBeInTheDocument()
  })

  it('shows the waiting caption on my icebreaker only until the other person sends something', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [MY_ICEBREAKER, THEIR_ICEBREAKER] })
    const { unmount } = render(<Chat match={MATCH} myUserId="me-1" onBack={vi.fn()} />)
    await waitFor(() => screen.getByText(t.chat.yourIcebreaker))
    expect(screen.getByText(t.chat.waitingForAnswer('Sara'))).toBeInTheDocument()
    unmount()

    vi.mocked(api.messages.list).mockResolvedValue({
      messages: [
        MY_ICEBREAKER,
        THEIR_ICEBREAKER,
        { id: 'm2', senderId: 'other-1', body: 'سلام!', createdAt: '2026-01-01T11:00:00Z', readAt: null, type: 'text' },
      ],
    })
    render(<Chat match={MATCH} myUserId="me-1" onBack={vi.fn()} />)
    await waitFor(() => screen.getByText('سلام!'))
    expect(screen.queryByText(t.chat.waitingForAnswer('Sara'))).not.toBeInTheDocument()
  })
})
