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

  it('shows the editing strip with the original body and cancels on ✕', () => {
    const onCancelEdit = vi.fn()
    render(
      <ChatInputBar
        draft="fixed" onDraftChange={vi.fn()} onSend={vi.fn()}
        editingBody="original text" onCancelEdit={onCancelEdit}
      />
    )

    expect(screen.getByText('Editing message')).toBeInTheDocument()
    expect(screen.getByText('original text')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Cancel'))
    expect(onCancelEdit).toHaveBeenCalled()
  })

  it('relabels the fallback button to Save in edit mode and hides it when empty', () => {
    const { rerender } = render(
      <ChatInputBar draft="fixed" onDraftChange={vi.fn()} onSend={vi.fn()} editingBody="orig" onCancelEdit={vi.fn()} />
    )
    expect(screen.getByLabelText('Save')).toBeInTheDocument()
    expect(screen.queryByLabelText('Send')).not.toBeInTheDocument()

    rerender(
      <ChatInputBar draft="   " onDraftChange={vi.fn()} onSend={vi.fn()} editingBody="orig" onCancelEdit={vi.fn()} />
    )
    expect(screen.queryByLabelText('Save')).not.toBeInTheDocument()
  })

  it('shows no editing strip in normal mode', () => {
    render(<ChatInputBar draft="hi" onDraftChange={vi.fn()} onSend={vi.fn()} />)
    expect(screen.queryByText('Editing message')).not.toBeInTheDocument()
  })
})
