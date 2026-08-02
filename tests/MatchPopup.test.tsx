import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MatchPopup } from '../src/components/MatchPopup.js'

const MATCH = {
  id: 'match-1',
  user: { id: 'other-1', name: 'Sara', telegramId: 99, username: 'sara', photos: [] },
}

describe('MatchPopup', () => {
  it('calls onMessage when the Message button is clicked', () => {
    const onMessage = vi.fn()
    render(<MatchPopup match={MATCH} onClose={vi.fn()} onMessage={onMessage} />)

    fireEvent.click(screen.getByText('Message Sara'))
    expect(onMessage).toHaveBeenCalled()
  })

  it('calls onClose when Keep swiping is clicked', () => {
    const onClose = vi.fn()
    render(<MatchPopup match={MATCH} onClose={onClose} onMessage={vi.fn()} />)

    fireEvent.click(screen.getByText('Keep swiping'))
    expect(onClose).toHaveBeenCalled()
  })
})
