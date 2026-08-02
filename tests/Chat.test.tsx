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
    messages: { list: vi.fn(), send: vi.fn() },
  },
}))

const MATCH: Match = {
  id: 'match-1',
  matchedAt: '2026-01-01T00:00:00Z',
  user: { id: 'other-1', name: 'Sara', photos: [], telegramId: 99, username: 'sara' },
  lastMessage: null,
  unreadCount: 0,
}

describe('Chat', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads and renders messages from both participants', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({
      messages: [
        { id: 'm1', senderId: 'me-1', body: 'hey', createdAt: '2026-01-01T10:00:00Z' },
        { id: 'm2', senderId: 'other-1', body: 'hi there', createdAt: '2026-01-01T10:01:00Z' },
      ],
    })

    render(<Chat match={MATCH} myUserId="me-1" />)

    await waitFor(() => screen.getByText('hey'))
    expect(screen.getByText('hi there')).toBeInTheDocument()
  })

  it('sends a message, appends it, and clears the input', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [] })
    vi.mocked(api.messages.send).mockResolvedValue({
      message: { id: 'm3', senderId: 'me-1', body: 'yo', createdAt: '2026-01-01T10:02:00Z' },
    })

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByPlaceholderText('Type a message…'))

    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: 'yo' } })
    fireEvent.click(screen.getByText('Send'))

    await waitFor(() => expect(screen.getByText('yo')).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Type a message…')).toHaveValue('')
  })

  it('shows an inline error and keeps the draft when sending fails', async () => {
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [] })
    vi.mocked(api.messages.send).mockRejectedValue(new Error('network'))

    render(<Chat match={MATCH} myUserId="me-1" />)
    await waitFor(() => screen.getByPlaceholderText('Type a message…'))

    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: 'yo' } })
    fireEvent.click(screen.getByText('Send'))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Type a message…')).toHaveValue('yo')
  })

  it('shows an unavailable state when the match can no longer be loaded', async () => {
    vi.mocked(api.messages.list).mockRejectedValue(new Error('not found'))

    render(<Chat match={MATCH} myUserId="me-1" />)

    await waitFor(() => screen.getByText('This match is no longer available.'))
  })
})
