import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Chat } from '../src/screens/Chat.js'
import { api } from '../src/api.js'
import type { Match } from '../src/types.js'

vi.mock('../src/api.js', () => ({
  api: {
    auth: { verify: vi.fn() },
    profile: { get: vi.fn(), update: vi.fn() },
    photos: { getUploadUrl: vi.fn(), delete: vi.fn(), reorder: vi.fn(), uploadFile: vi.fn() },
    discovery: { feed: vi.fn() },
    swipes: { swipe: vi.fn() },
    matches: { list: vi.fn() },
    messages: { list: vi.fn(), send: vi.fn(), edit: vi.fn(), delete: vi.fn() },
  },
}))

const MATCH: Match = {
  id: 'match-1',
  matchedAt: '2026-01-01T00:00:00Z',
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

describe('Chat', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads and renders messages from both participants', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({
      messages: [
        { id: 'm1', senderId: 'me-1', body: 'hey', createdAt: '2026-01-01T10:00:00Z', readAt: null },
        { id: 'm2', senderId: 'other-1', body: 'hi there', createdAt: '2026-01-01T10:01:00Z', readAt: null },
      ],
    })

    render(<Chat match={MATCH} myUserId="me-1" />)

    await waitFor(() => screen.getByText('hey'))
    expect(screen.getByText('hi there')).toBeInTheDocument()
  })

  it('sends a message, appends it, and clears the input', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [] })
    vi.mocked(api.messages.send).mockResolvedValue({
      message: { id: 'm3', senderId: 'me-1', body: 'yo', createdAt: '2026-01-01T10:02:00Z', readAt: null },
    })

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByPlaceholderText('Type a message…'))

    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: 'yo' } })
    fireEvent.click(screen.getByLabelText('Send'))

    await waitFor(() => expect(screen.getByText('yo')).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Type a message…')).toHaveValue('')
  })

  it('appends the message optimistically before the server responds', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [] })
    let resolveSend!: (v: { message: { id: string; senderId: string; body: string; createdAt: string; readAt: null } }) => void
    vi.mocked(api.messages.send).mockReturnValue(new Promise((r) => { resolveSend = r }))

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByPlaceholderText('Type a message…'))

    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: 'yo' } })
    fireEvent.click(screen.getByLabelText('Send'))

    // Visible immediately, marked as sending, input already cleared.
    expect(screen.getByText('yo')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Sending' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Type a message…')).toHaveValue('')

    resolveSend({ message: { id: 'm3', senderId: 'me-1', body: 'yo', createdAt: '2026-01-01T10:02:00Z', readAt: null } })
    await waitFor(() => expect(screen.queryByRole('img', { name: 'Sending' })).not.toBeInTheDocument())
    expect(screen.getByRole('img', { name: 'Sent' })).toBeInTheDocument()
  })

  it('marks a failed send and retries it on tap', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [] })
    vi.mocked(api.messages.send).mockRejectedValueOnce(new Error('network'))

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByPlaceholderText('Type a message…'))

    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: 'yo' } })
    fireEvent.click(screen.getByLabelText('Send'))

    await waitFor(() => screen.getByText('Failed — tap to retry'))
    expect(screen.getByText('yo')).toBeInTheDocument()

    vi.mocked(api.messages.send).mockResolvedValueOnce({
      message: { id: 'm3', senderId: 'me-1', body: 'yo', createdAt: '2026-01-01T10:02:00Z', readAt: null },
    })
    fireEvent.click(screen.getByText('Failed — tap to retry'))

    await waitFor(() => expect(screen.queryByText('Failed — tap to retry')).not.toBeInTheDocument())
    expect(screen.getByText('yo')).toBeInTheDocument()
  })

  it('shows the unavailable state only for a 404 load failure', async () => {
    vi.mocked(api.messages.list).mockRejectedValue(
      Object.assign(new Error('match_not_found'), { status: 404 })
    )

    render(<Chat match={MATCH} myUserId="me-1" />)

    await waitFor(() => screen.getByText('This match is no longer available.'))
  })

  it('shows a retry button on a network load failure and recovers on retry', async () => {
    vi.mocked(api.messages.list).mockRejectedValueOnce(new Error('network down'))

    render(<Chat match={MATCH} myUserId="me-1" />)

    await waitFor(() => screen.getByText("Couldn't load this chat."))

    vi.mocked(api.messages.list).mockResolvedValueOnce({
      messages: [{ id: 'm1', senderId: 'other-1', body: 'hi again', createdAt: '2026-01-01T10:00:00Z', readAt: null }],
    })
    fireEvent.click(screen.getByText('Try again'))

    await waitFor(() => screen.getByText('hi again'))
  })

  it('shows a single tick under the last message you sent when it has not been read', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({
      messages: [
        { id: 'm1', senderId: 'me-1', body: 'hey', createdAt: '2026-01-01T10:00:00Z', readAt: null },
      ],
    })

    render(<Chat match={MATCH} myUserId="me-1" />)

    await waitFor(() => screen.getByText('hey'))
    expect(screen.getByRole('img', { name: 'Sent' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Seen' })).not.toBeInTheDocument()
  })

  it('shows a double tick under the last message you sent once it is read', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({
      messages: [
        { id: 'm1', senderId: 'me-1', body: 'hey', createdAt: '2026-01-01T10:00:00Z', readAt: '2026-01-01T10:05:00Z' },
      ],
    })

    render(<Chat match={MATCH} myUserId="me-1" />)

    await waitFor(() => screen.getByText('hey'))
    expect(screen.getByRole('img', { name: 'Seen' })).toBeInTheDocument()
  })

  it('does not show a tick on the other participant\'s messages or on earlier messages you sent', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({
      messages: [
        { id: 'm1', senderId: 'me-1', body: 'first', createdAt: '2026-01-01T10:00:00Z', readAt: '2026-01-01T10:05:00Z' },
        { id: 'm2', senderId: 'other-1', body: 'reply', createdAt: '2026-01-01T10:01:00Z', readAt: null },
        { id: 'm3', senderId: 'me-1', body: 'second', createdAt: '2026-01-01T10:02:00Z', readAt: null },
      ],
    })

    render(<Chat match={MATCH} myUserId="me-1" />)

    await waitFor(() => screen.getByText('second'))
    // Only the last message I sent ("second") gets a tick — one "Sent" icon total.
    expect(screen.getAllByRole('img', { name: 'Sent' })).toHaveLength(1)
    expect(screen.queryByRole('img', { name: 'Seen' })).not.toBeInTheDocument()
  })

  it('renders a date chip above the messages', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({
      messages: [
        { id: 'm1', senderId: 'me-1', body: 'hey', createdAt: '2026-01-01T10:00:00Z', readAt: null },
      ],
    })

    render(<Chat match={MATCH} myUserId="me-1" />)

    await waitFor(() => screen.getByText('hey'))
    // 2026-01-01 is far from "today", so the chip shows a short date.
    expect(screen.getByText(/Jan(uary)? 1/)).toBeInTheDocument()
  })

  it('refetches messages when the app becomes visible again', async () => {
    vi.mocked(api.messages.list).mockResolvedValueOnce({ messages: [] })

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByPlaceholderText('Type a message…'))

    vi.mocked(api.messages.list).mockResolvedValueOnce({
      messages: [{ id: 'm9', senderId: 'other-1', body: 'im back', createdAt: '2026-01-01T11:00:00Z', readAt: null }],
    })
    fireEvent(document, new Event('visibilitychange'))

    await waitFor(() => screen.getByText('im back'))
    expect(api.messages.list).toHaveBeenCalledTimes(2)
  })

  it('does not duplicate a bubble when a send resolves after a visibility refresh already merged the same message', async () => {
    vi.mocked(api.messages.list).mockResolvedValueOnce({ messages: [] })
    let resolveSend!: (v: { message: { id: string; senderId: string; body: string; createdAt: string; readAt: null } }) => void
    vi.mocked(api.messages.send).mockReturnValue(new Promise((r) => { resolveSend = r }))

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByPlaceholderText('Type a message…'))

    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: 'yo' } })
    fireEvent.click(screen.getByLabelText('Send'))

    // Optimistic bubble appears while the send is still in flight.
    expect(screen.getByText('yo')).toBeInTheDocument()

    // App backgrounds and the server has already committed the message by the
    // time a visibility refresh runs — the refetch merges the committed copy
    // in alongside the still-pending optimistic local.
    vi.mocked(api.messages.list).mockResolvedValueOnce({
      messages: [{ id: 'm77', senderId: 'me-1', body: 'yo', createdAt: '2026-01-01T10:02:00Z', readAt: null }],
    })
    fireEvent(document, new Event('visibilitychange'))
    await waitFor(() => expect(api.messages.list).toHaveBeenCalledTimes(2))

    // The original send promise then resolves with the same server id.
    resolveSend({ message: { id: 'm77', senderId: 'me-1', body: 'yo', createdAt: '2026-01-01T10:02:00Z', readAt: null } })

    await waitFor(() => expect(screen.getAllByText('yo')).toHaveLength(1))
    expect(screen.queryByRole('img', { name: 'Sending' })).not.toBeInTheDocument()
  })

  it('shows the empty state for a fresh match and prefills the input from a chip', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [] })

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByText('You matched with Sara'))

    fireEvent.click(screen.getByText("Hey! How's your week going? 😊"))
    expect(screen.getByPlaceholderText('Type a message…')).toHaveValue("Hey! How's your week going? 😊")
  })

  it('opens a profile peek from the header and closes it again', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({
      messages: [{ id: 'm1', senderId: 'other-1', body: 'hi', createdAt: '2026-01-01T10:00:00Z', readAt: null }],
    })

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByText('hi'))

    fireEvent.click(screen.getByRole('button', { name: 'View profile' }))
    expect(screen.getByText('Coffee person')).toBeInTheDocument()
    expect(screen.getByText('My perfect Sunday')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByText('Coffee person')).not.toBeInTheDocument()
  })

  it('shows a jump-to-latest chip only when scrolled away from the bottom', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({
      messages: [{ id: 'm1', senderId: 'other-1', body: 'hi', createdAt: '2026-01-01T10:00:00Z', readAt: null }],
    })

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByText('hi'))

    expect(screen.queryByLabelText('Scroll to latest')).not.toBeInTheDocument()

    const list = screen.getByRole('log')
    Object.defineProperty(list, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(list, 'clientHeight', { value: 400, configurable: true })
    Object.defineProperty(list, 'scrollTop', { value: 0, writable: true, configurable: true })
    fireEvent.scroll(list)

    expect(screen.getByLabelText('Scroll to latest')).toBeInTheDocument()

    list.scrollTop = 600 // back at the bottom: 1000 - 600 - 400 = 0
    fireEvent.scroll(list)
    expect(screen.queryByLabelText('Scroll to latest')).not.toBeInTheDocument()
  })

  const MINE = { id: 'm1', senderId: 'me-1', body: 'hey', createdAt: '2026-01-01T10:00:00Z', readAt: null }
  const THEIRS = { id: 'm2', senderId: 'other-1', body: 'hi there', createdAt: '2026-01-01T10:01:00Z', readAt: null }

  it('opens the action sheet on context-menu of my own message only', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [MINE, THEIRS] })

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByText('hey'))

    fireEvent.contextMenu(screen.getByText('hi there'))
    expect(screen.queryByRole('menu', { name: 'Message actions' })).not.toBeInTheDocument()

    fireEvent.contextMenu(screen.getByText('hey'))
    expect(screen.getByRole('menu', { name: 'Message actions' })).toBeInTheDocument()
  })

  it('edits a message optimistically through the sheet and input bar', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [MINE] })
    vi.mocked(api.messages.edit).mockResolvedValue({
      message: { ...MINE, body: 'hey fixed', editedAt: '2026-01-02T09:00:00Z' },
    })

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByText('hey'))

    fireEvent.contextMenu(screen.getByText('hey'))
    fireEvent.click(screen.getByText('Edit'))

    // Edit mode: strip visible, input prefilled with the original body.
    expect(screen.getByText('Editing message')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Type a message…')).toHaveValue('hey')

    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: 'hey fixed' } })
    fireEvent.click(screen.getByLabelText('Save'))

    // Optimistic body swap, then the edited label once the server confirms.
    expect(screen.getByText('hey fixed')).toBeInTheDocument()
    expect(screen.queryByText('Editing message')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('edited')).toBeInTheDocument())
    expect(api.messages.edit).toHaveBeenCalledWith('match-1', 'm1', 'hey fixed')
  })

  it('reverts an edit when the server rejects it', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [MINE] })
    vi.mocked(api.messages.edit).mockRejectedValue(new Error('network'))

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByText('hey'))

    fireEvent.contextMenu(screen.getByText('hey'))
    fireEvent.click(screen.getByText('Edit'))
    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: 'hey broken' } })
    fireEvent.click(screen.getByLabelText('Save'))

    await waitFor(() => expect(screen.getByText('hey')).toBeInTheDocument())
    expect(screen.queryByText('hey broken')).not.toBeInTheDocument()
  })

  it('cancelling an edit restores the stashed draft', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [MINE] })

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByText('hey'))

    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: 'half-typed draft' } })
    fireEvent.contextMenu(screen.getByText('hey'))
    fireEvent.click(screen.getByText('Edit'))
    expect(screen.getByPlaceholderText('Type a message…')).toHaveValue('hey')

    fireEvent.click(screen.getByLabelText('Cancel'))
    expect(screen.queryByText('Editing message')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Type a message…')).toHaveValue('half-typed draft')
  })

  it('deletes a message optimistically', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [MINE, THEIRS] })
    vi.mocked(api.messages.delete).mockResolvedValue({ ok: true })

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByText('hey'))

    fireEvent.contextMenu(screen.getByText('hey'))
    fireEvent.click(screen.getByText('Delete'))

    expect(screen.queryByText('hey')).not.toBeInTheDocument()
    expect(screen.getByText('hi there')).toBeInTheDocument()
    await waitFor(() => expect(api.messages.delete).toHaveBeenCalledWith('match-1', 'm1'))
  })

  it('restores a deleted message when the server fails with a non-404', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [MINE, THEIRS] })
    vi.mocked(api.messages.delete).mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }))

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByText('hey'))

    fireEvent.contextMenu(screen.getByText('hey'))
    fireEvent.click(screen.getByText('Delete'))
    expect(screen.queryByText('hey')).not.toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('hey')).toBeInTheDocument())
  })

  it('treats a 404 delete as success (already gone)', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [MINE, THEIRS] })
    vi.mocked(api.messages.delete).mockRejectedValue(Object.assign(new Error('message_not_found'), { status: 404 }))

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByText('hey'))

    fireEvent.contextMenu(screen.getByText('hey'))
    fireEvent.click(screen.getByText('Delete'))

    await waitFor(() => expect(api.messages.delete).toHaveBeenCalled())
    expect(screen.queryByText('hey')).not.toBeInTheDocument()
  })

  it('deletes a failed message locally without calling the server', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [] })
    vi.mocked(api.messages.send).mockRejectedValueOnce(new Error('network'))

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByPlaceholderText('Type a message…'))

    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: 'yo' } })
    fireEvent.click(screen.getByLabelText('Send'))
    await waitFor(() => screen.getByText('Failed — tap to retry'))

    fireEvent.contextMenu(screen.getByText('yo'))
    expect(screen.getByText('Retry')).toBeInTheDocument() // failed variant, no Edit
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Delete'))
    await waitFor(() => screen.getByText('You matched with Sara')) // back to empty state
    expect(api.messages.delete).not.toHaveBeenCalled()
  })

  it('exits edit mode without a request when saving an emptied draft', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [MINE] })

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByText('hey'))

    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: 'wip draft' } })
    fireEvent.contextMenu(screen.getByText('hey'))
    fireEvent.click(screen.getByText('Edit'))
    expect(screen.getByPlaceholderText('Type a message…')).toHaveValue('hey')

    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: '' } })
    fireEvent.keyDown(screen.getByPlaceholderText('Type a message…'), { key: 'Enter' })

    expect(screen.queryByText('Editing message')).not.toBeInTheDocument()
    expect(api.messages.edit).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText('Type a message…')).toHaveValue('wip draft')
  })

  it('does not duplicate a bubble when a visibility refresh lands while an edit is in flight', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [MINE] })
    let resolveEdit!: (v: { message: typeof MINE & { editedAt: string } }) => void
    vi.mocked(api.messages.edit).mockReturnValue(new Promise((r) => { resolveEdit = r }))

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByText('hey'))

    fireEvent.contextMenu(screen.getByText('hey'))
    fireEvent.click(screen.getByText('Edit'))
    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: 'hey fixed' } })
    fireEvent.click(screen.getByLabelText('Save'))

    expect(screen.getByText('hey fixed')).toBeInTheDocument()

    // A visibility refresh lands mid-flight and returns the stale (pre-edit) body.
    vi.mocked(api.messages.list).mockResolvedValueOnce({ messages: [MINE] })
    fireEvent(document, new Event('visibilitychange'))
    await waitFor(() => expect(api.messages.list).toHaveBeenCalledTimes(2))

    expect(screen.getAllByText('hey fixed')).toHaveLength(1)
    expect(screen.queryByText('hey')).not.toBeInTheDocument()

    resolveEdit({ message: { ...MINE, body: 'hey fixed', editedAt: '2026-01-02T09:00:00Z' } })
    await waitFor(() => expect(screen.getByText('edited')).toBeInTheDocument())
    expect(screen.getAllByText('hey fixed')).toHaveLength(1)
  })
})
