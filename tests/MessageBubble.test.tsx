import { render, screen, fireEvent, act } from '@testing-library/react'
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

  it('calls onRetry when failed bubble is activated via keyboard (Enter)', () => {
    const onRetry = vi.fn()
    render(
      <MessageBubble message={{ ...BASE, status: 'failed' }} mine first last showTicks={false} onRetry={onRetry} />
    )
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
    expect(onRetry).toHaveBeenCalledWith('m1')
  })

  it('calls onRetry when failed bubble is activated via keyboard (Space)', () => {
    const onRetry = vi.fn()
    render(
      <MessageBubble message={{ ...BASE, status: 'failed' }} mine first last showTicks={false} onRetry={onRetry} />
    )
    const bubble = screen.getByRole('button')
    fireEvent.keyDown(bubble, { key: ' ' })
    expect(onRetry).toHaveBeenCalledWith('m1')
  })

  it('shows an edited label when the message has been edited', () => {
    render(
      <MessageBubble
        message={{ ...BASE, editedAt: '2026-08-03T11:00:00Z' }}
        mine first last={false} showTicks={false}
      />
    )
    expect(screen.getByText('edited')).toBeInTheDocument()
  })

  it('does not show an edited label on an unedited message', () => {
    render(<MessageBubble message={BASE} mine first last showTicks={false} />)
    expect(screen.queryByText('edited')).not.toBeInTheDocument()
  })

  it('fires onLongPress on context menu (desktop right-click)', () => {
    const onLongPress = vi.fn()
    render(<MessageBubble message={BASE} mine first last showTicks={false} onLongPress={onLongPress} />)
    fireEvent.contextMenu(screen.getByText('hello there'))
    expect(onLongPress).toHaveBeenCalledWith('m1')
  })

  it('fires onLongPress after holding a press for 450ms', () => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    render(<MessageBubble message={BASE} mine first last showTicks={false} onLongPress={onLongPress} />)

    const bubble = screen.getByText('hello there')
    fireEvent.pointerDown(bubble, { clientX: 10, clientY: 10 })
    act(() => { vi.advanceTimersByTime(500) })
    expect(onLongPress).toHaveBeenCalledWith('m1')
    vi.useRealTimers()
  })

  it('does not fire onLongPress when the press is released early or moves', () => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    render(<MessageBubble message={BASE} mine first last showTicks={false} onLongPress={onLongPress} />)

    const bubble = screen.getByText('hello there')
    fireEvent.pointerDown(bubble, { clientX: 10, clientY: 10 })
    act(() => { vi.advanceTimersByTime(200) })
    fireEvent.pointerUp(bubble)
    act(() => { vi.advanceTimersByTime(500) })
    expect(onLongPress).not.toHaveBeenCalled()

    fireEvent.pointerDown(bubble, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(bubble, { clientX: 10, clientY: 40 }) // scrolled away
    act(() => { vi.advanceTimersByTime(500) })
    expect(onLongPress).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
