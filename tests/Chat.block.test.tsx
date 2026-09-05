import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/api.js', () => ({
  api: {
    messages: { list: vi.fn(), send: vi.fn(), edit: vi.fn(), delete: vi.fn() },
    blocks: { create: vi.fn() },
  },
}))
vi.mock('../src/telegram.js', () => ({
  haptic: { impact: vi.fn(), selection: vi.fn(), notification: vi.fn() },
  useBackButton: vi.fn(),
}))

import { api } from '../src/api.js'
import { t } from '../src/i18n.js'
import { Chat } from '../src/screens/Chat.js'
import type { Match } from '../src/types.js'

const MATCH: Match = {
  id: 'm1',
  matchedAt: '2026-01-01T00:00:00Z',
  user: {
    id: 'u-2', name: 'Sara', photos: [], telegramId: 99, username: null,
    age: 24, bio: null, icebreakerPrompt: null, icebreakerAnswer: null,
  },
  lastMessage: null,
  unreadCount: 0,
}

describe('Chat block action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [] })
  })

  it('blocking from the header calls the API and leaves the chat', async () => {
    vi.mocked(api.blocks.create).mockResolvedValue({ ok: true })
    const onBack = vi.fn()
    render(<Chat match={MATCH} myUserId="u-1" onBack={onBack} />)

    // Wait for the header to render past the loading state.
    await waitFor(() => screen.getByRole('button', { name: t.block.action }))
    await userEvent.click(screen.getByRole('button', { name: t.block.action }))

    await userEvent.click(screen.getByRole('button', { name: t.block.confirm(MATCH.user.name) }))

    await waitFor(() => expect(api.blocks.create).toHaveBeenCalledWith('u-2'))
    await waitFor(() => expect(onBack).toHaveBeenCalled())
  })
})
