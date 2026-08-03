import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MessageBubble } from '../src/components/chat/MessageBubble.js'
import type { LocalMessage } from '../src/types.js'

const BASE: LocalMessage = {
  id: 'm1',
  senderId: 'me',
  body: 'hello there',
  createdAt: '2026-08-03T10:00:00Z',
  readAt: null,
}

describe('MessageBubble', () => {
  it('shows the timestamp only on the last bubble of a group', () => {
    const { rerender } = render(
      <MessageBubble message={BASE} mine first={true} last={false} showTicks={false} />
    )
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).not.toBeInTheDocument()

    rerender(<MessageBubble message={BASE} mine first={false} last={true} showTicks={false} />)
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument()
  })

  it('shows seen ticks when showTicks is set and the message is read', () => {
    render(
      <MessageBubble
        message={{ ...BASE, readAt: '2026-08-03T10:05:00Z' }}
        mine first last showTicks
      />
    )
    expect(screen.getByRole('img', { name: 'Seen' })).toBeInTheDocument()
  })

  it('shows a sending indicator instead of a timestamp while pending', () => {
    render(<MessageBubble message={{ ...BASE, status: 'sending' }} mine first last showTicks={false} />)
    expect(screen.getByRole('img', { name: 'Sending' })).toBeInTheDocument()
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).not.toBeInTheDocument()
  })

  it('renders a failed state and calls onRetry when tapped', () => {
    const onRetry = vi.fn()
    render(
      <MessageBubble message={{ ...BASE, status: 'failed' }} mine first last showTicks={false} onRetry={onRetry} />
    )
    fireEvent.click(screen.getByText('Failed — tap to retry'))
    expect(onRetry).toHaveBeenCalledWith('m1')
  })
})
