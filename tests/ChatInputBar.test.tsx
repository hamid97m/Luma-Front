import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ChatInputBar } from '../src/components/chat/ChatInputBar.js'

describe('ChatInputBar', () => {
  it('sends on Enter and inserts a newline on Shift+Enter', () => {
    const onSend = vi.fn()
    render(<ChatInputBar draft="hello" onDraftChange={vi.fn()} onSend={onSend} />)

    const box = screen.getByPlaceholderText('Type a message…')
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()

    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('hides the fallback send button when the draft is blank', () => {
    const { rerender } = render(<ChatInputBar draft="" onDraftChange={vi.fn()} onSend={vi.fn()} />)
    expect(screen.queryByLabelText('Send')).not.toBeInTheDocument()

    rerender(<ChatInputBar draft="hi" onDraftChange={vi.fn()} onSend={vi.fn()} />)
    expect(screen.getByLabelText('Send')).toBeInTheDocument()
  })

  it('shows a remaining-characters counter only near the 2000 limit', () => {
    const { rerender } = render(
      <ChatInputBar draft={'a'.repeat(100)} onDraftChange={vi.fn()} onSend={vi.fn()} />
    )
    expect(screen.queryByText('1900')).not.toBeInTheDocument()

    rerender(<ChatInputBar draft={'a'.repeat(1850)} onDraftChange={vi.fn()} onSend={vi.fn()} />)
    expect(screen.getByText('150')).toBeInTheDocument()
  })
})
