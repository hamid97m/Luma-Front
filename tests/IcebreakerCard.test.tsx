import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MessageBubble } from '../src/components/chat/MessageBubble.js'
import { t } from '../src/i18n.js'
import type { LocalMessage } from '../src/types.js'

const ICEBREAKER: LocalMessage = {
  id: 'ib-1',
  senderId: 'other-1',
  body: 'جمعه ایده‌آل من…',
  icebreakerAnswer: 'کوه و بعد صبحانه',
  createdAt: '2026-08-03T10:00:00Z',
  readAt: null,
  type: 'icebreaker',
}

describe('IcebreakerCard (via MessageBubble)', () => {
  it("shows the other person's label, prompt, answer and localized question, and answers on tap", () => {
    const onAnswer = vi.fn()
    render(
      <MessageBubble
        message={ICEBREAKER}
        mine={false}
        first last showTicks={false}
        counterpartName="Sara"
        onAnswer={onAnswer}
      />
    )
    expect(screen.getByText(t.chat.icebreakerOf('Sara'))).toBeInTheDocument()
    expect(screen.getByText('جمعه ایده‌آل من…')).toBeInTheDocument()
    expect(screen.getByText('“کوه و بعد صبحانه”')).toBeInTheDocument()
    expect(screen.getByText('جمعه ایده‌آل تو چه شکلی است؟')).toBeInTheDocument()
    expect(screen.queryByText(t.chat.waitingForAnswer('Sara'))).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: t.chat.answerIt }))
    expect(onAnswer).toHaveBeenCalledWith('ib-1')
  })

  it('labels my own icebreaker and shows the waiting caption while the other person is silent', () => {
    const { rerender } = render(
      <MessageBubble
        message={{ ...ICEBREAKER, senderId: 'me-1' }}
        mine
        first last showTicks={false}
        counterpartName="Sara"
        awaitingAnswer
      />
    )
    expect(screen.getByText(t.chat.yourIcebreaker)).toBeInTheDocument()
    expect(screen.getByText(t.chat.waitingForAnswer('Sara'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.chat.answerIt })).not.toBeInTheDocument()

    rerender(
      <MessageBubble
        message={{ ...ICEBREAKER, senderId: 'me-1' }}
        mine
        first last showTicks={false}
        counterpartName="Sara"
        awaitingAnswer={false}
      />
    )
    expect(screen.queryByText(t.chat.waitingForAnswer('Sara'))).not.toBeInTheDocument()
  })

  it('falls back to the generic question for a custom prompt', () => {
    render(
      <MessageBubble
        message={{ ...ICEBREAKER, body: 'My perfect Sunday' }}
        mine={false}
        first last showTicks={false}
        counterpartName="Sara"
      />
    )
    expect(screen.getByText(t.chat.icebreakerFallbackQuestion)).toBeInTheDocument()
  })

  it('has no long-press action sheet', () => {
    const onLongPress = vi.fn()
    render(
      <MessageBubble
        message={ICEBREAKER}
        mine={false}
        first last showTicks={false}
        counterpartName="Sara"
        onLongPress={onLongPress}
      />
    )
    fireEvent.contextMenu(screen.getByText('جمعه ایده‌آل من…'))
    expect(onLongPress).not.toHaveBeenCalled()
  })
})
