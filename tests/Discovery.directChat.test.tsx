import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Discovery } from '../src/screens/Discovery.js'
import { api } from '../src/api.js'
import { t } from '../src/i18n.js'

vi.mock('../src/api.js', () => ({
  api: {
    discovery: { feed: vi.fn() },
    swipes: { swipe: vi.fn() },
    directChat: { start: vi.fn() },
    premium: { status: vi.fn().mockResolvedValue({ enabled: true, premiumUntil: null, plans: [] }) },
  },
}))

const PROFILES = [{ id: 'p1', name: 'Sara', age: 24, bio: 'Hi', telegramId: 99, photos: ['https://img1'], interests: [], location: null }]

beforeEach(() => vi.clearAllMocks())

describe('Discovery direct chat', () => {
  it('gate=free → tapping chat starts a chat immediately and opens it', async () => {
    vi.mocked(api.discovery.feed).mockResolvedValue({ profiles: PROFILES, exhausted: false, directChat: { gate: 'free', remaining: 3, limit: 3, resetAt: null } })
    vi.mocked(api.directChat.start).mockResolvedValue({ created: true, match: { id: 'm1', user: { id: 'p1', name: 'Sara', telegramId: 99, username: null } } })
    const onOpenChat = vi.fn()
    render(<Discovery onOpenChat={onOpenChat} />)
    await waitFor(() => screen.getByText('Sara'))
    fireEvent.click(screen.getByRole('button', { name: t.aria.directChat }))
    await waitFor(() => expect(api.directChat.start).toHaveBeenCalledWith('p1'))
    await waitFor(() => expect(onOpenChat).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' })))
  })

  it('gate=paywall → tapping chat opens the sheet with the go-premium CTA', async () => {
    vi.mocked(api.discovery.feed).mockResolvedValue({ profiles: PROFILES, exhausted: false, directChat: { gate: 'paywall', remaining: 3, limit: 3, resetAt: null } })
    render(<Discovery onOpenChat={vi.fn()} />)
    await waitFor(() => screen.getByText('Sara'))
    fireEvent.click(screen.getByRole('button', { name: t.aria.directChat }))
    await waitFor(() => expect(screen.getByText(t.directChat.goPremiumCta)).toBeInTheDocument())
    expect(api.directChat.start).not.toHaveBeenCalled()
  })

  it('gate=quota remaining>0 → premium chats directly, no sheet', async () => {
    vi.mocked(api.discovery.feed).mockResolvedValue({ profiles: PROFILES, exhausted: false, directChat: { gate: 'quota', remaining: 2, limit: 3, resetAt: '2026-09-06T12:00:00.000Z' } })
    vi.mocked(api.directChat.start).mockResolvedValue({ created: true, match: { id: 'm2', user: { id: 'p1', name: 'Sara', telegramId: 99, username: null } }, directChat: { remaining: 1, resetAt: '2026-09-06T12:00:00.000Z' } })
    const onOpenChat = vi.fn()
    render(<Discovery onOpenChat={onOpenChat} />)
    await waitFor(() => screen.getByText('Sara'))
    fireEvent.click(screen.getByRole('button', { name: t.aria.directChat }))
    // No confirmation sheet — the chat opens straight away.
    await waitFor(() => expect(api.directChat.start).toHaveBeenCalledWith('p1'))
    await waitFor(() => expect(onOpenChat).toHaveBeenCalledWith(expect.objectContaining({ id: 'm2' })))
    expect(screen.queryByText(t.directChat.startCta)).not.toBeInTheDocument()
  })

  it('gate=quota remaining=0 → limit sheet, no start CTA', async () => {
    vi.mocked(api.discovery.feed).mockResolvedValue({ profiles: PROFILES, exhausted: false, directChat: { gate: 'quota', remaining: 0, limit: 3, resetAt: new Date(Date.now() + 3600_000).toISOString() } })
    render(<Discovery onOpenChat={vi.fn()} />)
    await waitFor(() => screen.getByText('Sara'))
    fireEvent.click(screen.getByRole('button', { name: t.aria.directChat }))
    await waitFor(() => expect(screen.getByText(t.directChat.limitTitle)).toBeInTheDocument())
    expect(screen.queryByText(t.directChat.startCta)).not.toBeInTheDocument()
  })
})
