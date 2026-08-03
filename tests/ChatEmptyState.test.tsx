import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ChatEmptyState } from '../src/components/chat/ChatEmptyState.js'
import type { Match } from '../src/types.js'

const MATCH: Match = {
  id: 'match-1',
  matchedAt: '2026-08-01T00:00:00Z',
  user: {
    id: 'other-1',
    name: 'Sara',
    photos: [],
    telegramId: 99,
    username: 'sara',
    age: 24,
    bio: 'Coffee person',
    icebreakerPrompt: 'My perfect Sunday',
    icebreakerAnswer: 'Hiking then pancakes',
  },
  lastMessage: null,
  unreadCount: 0,
}

describe('ChatEmptyState', () => {
  it('shows who you matched with and their icebreaker', () => {
    render(<ChatEmptyState match={MATCH} onPrefill={vi.fn()} />)

    expect(screen.getByText('You matched with Sara')).toBeInTheDocument()
    expect(screen.getByText('My perfect Sunday')).toBeInTheDocument()
    expect(screen.getByText(/Hiking then pancakes/)).toBeInTheDocument()
  })

  it('prefills a follow-up about the icebreaker answer', () => {
    const onPrefill = vi.fn()
    render(<ChatEmptyState match={MATCH} onPrefill={onPrefill} />)

    fireEvent.click(screen.getByText('Ask about it'))
    expect(onPrefill).toHaveBeenCalledWith(expect.stringContaining('Hiking then pancakes'))
  })

  it('omits the icebreaker card when the user has none, but still shows openers', () => {
    const bare: Match = {
      ...MATCH,
      user: { ...MATCH.user, icebreakerPrompt: null, icebreakerAnswer: null },
    }
    const onPrefill = vi.fn()
    render(<ChatEmptyState match={bare} onPrefill={onPrefill} />)

    expect(screen.queryByText('Ask about it')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("Hey! How's your week going? 😊"))
    expect(onPrefill).toHaveBeenCalledWith("Hey! How's your week going? 😊")
  })
})
