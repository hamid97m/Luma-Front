import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Chat } from '../src/screens/Chat.js'
import { api } from '../src/api.js'
import { useAuthStore } from '../src/store.js'
import type { Match, UserProfile } from '../src/types.js'

vi.mock('../src/api.js', () => ({
  api: {
    messages: { list: vi.fn(), send: vi.fn(), edit: vi.fn(), delete: vi.fn() },
    premium: { status: vi.fn() },
    reports: { create: vi.fn() },
  },
}))

const MATCH: Match = {
  id: 'match-1',
  matchedAt: '2026-01-01T00:00:00Z',
  user: { id: 'other-1', name: 'Ali', photos: [], telegramId: 99, username: 'ali', age: 28, bio: null, icebreakerPrompt: null, icebreakerAnswer: null },
  lastMessage: null,
  unreadCount: 0,
}

const asGender = (gender: UserProfile['gender']) =>
  useAuthStore.setState({ user: { id: 'me-1', gender } as UserProfile })

const renderChat = () => render(<Chat match={MATCH} myUserId="me-1" onBack={() => {}} />)

describe('report tooltip in chat (women)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(api.messages.list).mockResolvedValue({ messages: [] })
  })
  afterEach(() => useAuthStore.setState({ user: null }))

  it('shows on every visit until the report flag is tapped, then never again', async () => {
    asGender('woman')
    const first = renderChat()
    expect(await screen.findByTestId('report-tooltip')).toHaveTextContent('هر مشکلی رو ریپورت کنید، سریع بررسی میکنیم')
    first.unmount()

    // Still there on the next visit — it isn't dismissed by just seeing it.
    const second = renderChat()
    expect(await screen.findByTestId('report-tooltip')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'گزارش کاربر' }))
    await waitFor(() => expect(screen.queryByTestId('report-tooltip')).not.toBeInTheDocument())
    second.unmount()

    renderChat()
    await screen.findByRole('button', { name: 'گزارش کاربر' })
    expect(screen.queryByTestId('report-tooltip')).not.toBeInTheDocument()
  })

  it('tapping the tooltip itself opens the report sheet and dismisses it for good', async () => {
    asGender('woman')
    const { unmount } = renderChat()
    fireEvent.click(await screen.findByTestId('report-tooltip'))
    expect(screen.queryByTestId('report-tooltip')).not.toBeInTheDocument()
    unmount()
    renderChat()
    await screen.findByRole('button', { name: 'گزارش کاربر' })
    expect(screen.queryByTestId('report-tooltip')).not.toBeInTheDocument()
  })

  it('is never shown to men', async () => {
    asGender('man')
    renderChat()
    await screen.findByRole('button', { name: 'گزارش کاربر' })
    expect(screen.queryByTestId('report-tooltip')).not.toBeInTheDocument()
  })
})
