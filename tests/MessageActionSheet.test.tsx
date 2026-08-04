import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MessageActionSheet } from '../src/components/chat/MessageActionSheet.js'
import type { LocalMessage } from '../src/types.js'

const MSG: LocalMessage = {
  id: 'm1',
  senderId: 'me',
  body: 'hello there',
  createdAt: '2026-08-03T10:00:00Z',
  readAt: null,
}

describe('MessageActionSheet', () => {
  it('offers Reply, Edit and Delete for a confirmed own message', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const onReply = vi.fn()
    render(
      <MessageActionSheet message={MSG} mine onReply={onReply} onEdit={onEdit} onDelete={onDelete} onRetry={vi.fn()} onClose={vi.fn()} />
    )

    expect(screen.queryByText('Retry')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Reply'))
    expect(onReply).toHaveBeenCalledWith('m1')
    fireEvent.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledWith('m1')
    fireEvent.click(screen.getByText('Delete'))
    expect(onDelete).toHaveBeenCalledWith('m1')
  })

  it('offers only Reply (no Edit/Delete) for the other person\'s message', () => {
    const onReply = vi.fn()
    render(
      <MessageActionSheet
        message={{ ...MSG, senderId: 'them' }} mine={false} onReply={onReply}
        onEdit={vi.fn()} onDelete={vi.fn()} onRetry={vi.fn()} onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Reply')).toBeInTheDocument()
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Reply'))
    expect(onReply).toHaveBeenCalledWith('m1')
  })

  it('offers Retry and Delete instead of Edit/Reply for a failed message', () => {
    const onRetry = vi.fn()
    render(
      <MessageActionSheet
        message={{ ...MSG, status: 'failed' }} mine onReply={vi.fn()}
        onEdit={vi.fn()} onDelete={vi.fn()} onRetry={onRetry} onClose={vi.fn()}
      />
    )

    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    expect(screen.queryByText('Reply')).not.toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Retry'))
    expect(onRetry).toHaveBeenCalledWith('m1')
  })

  it('closes on Cancel and on backdrop click, but not on sheet click', () => {
    const onClose = vi.fn()
    render(
      <MessageActionSheet message={MSG} mine onReply={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onRetry={vi.fn()} onClose={onClose} />
    )

    fireEvent.click(screen.getByText('hello there')) // inside the sheet
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('menu', { name: 'Message actions' }).parentElement!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
