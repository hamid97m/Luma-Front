import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('../src/api.js', () => ({
  api: {
    asks: {
      friends: vi.fn(),
      removeFriend: vi.fn(() => Promise.resolve({ ok: true })),
      create: vi.fn(),
      event: vi.fn(() => Promise.resolve()),
    },
  },
}))
vi.mock('../src/telegram.js', () => ({
  haptic: { impact: vi.fn(), selection: vi.fn(), notification: vi.fn() },
  useBackButton: vi.fn(),
  openTelegramLink: vi.fn(),
  telegramFirstName: () => 'Sara',
}))

import { api } from '../src/api.js'
import { t } from '../src/i18n.js'
import { openTelegramLink } from '../src/telegram.js'
import { AskSheet } from '../src/components/ask/AskSheet.js'

const TARGET = { id: 'target-1', name: 'Amir' }
const ASK = {
  id: 'ask-1', targetId: 'target-1', targetName: 'Amir', targetPhotoUrl: null, question: 'reply' as const,
  status: 'open' as const, createdAt: '2026-11-20T10:00:00Z', expiresAt: '2026-11-22T10:00:00Z',
  total: 1, answered: 0, yes: 0, unsure: 0, no: 0,
}
const FRIENDS = [
  { id: 'f1', name: 'Negar', photoUrl: null, lastInteractionAt: new Date().toISOString() },
  { id: 'f2', name: 'Maryam', photoUrl: null, lastInteractionAt: new Date().toISOString() },
]

const renderSheet = (props: Partial<Parameters<typeof AskSheet>[0]> = {}) =>
  render(<AskSheet open target={TARGET} onClose={vi.fn()} {...props} />)

describe('AskSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.Telegram!.WebApp!.showAlert = vi.fn()
    vi.mocked(api.asks.friends).mockResolvedValue({ friends: [] })
  })

  it('shows title, privacy line and the three question chips (reply selected by default)', async () => {
    renderSheet()
    expect(screen.getByText(t.ask.sheetTitle('Amir'))).toBeInTheDocument()
    expect(screen.getByText(t.ask.sheetPrivacy('Amir'))).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: t.ask.questions.reply })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: t.ask.questions.date })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: t.ask.questions.red_flag })).toBeInTheDocument()
  })

  it('hides the friends section when the list is empty; submit disabled at 0 recipients', async () => {
    renderSheet()
    await waitFor(() => expect(api.asks.friends).toHaveBeenCalled())
    expect(screen.queryByText(t.ask.friendsLabel)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.ask.submitEmpty })).toBeDisabled()
  })

  it('caps recipients at 3 across members and links', async () => {
    vi.mocked(api.asks.friends).mockResolvedValue({ friends: FRIENDS })
    renderSheet()
    await screen.findByText('Negar')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Negar' }))
    fireEvent.click(screen.getByTestId('ask-add-link'))
    fireEvent.click(screen.getByTestId('ask-add-link'))
    expect(screen.getByRole('button', { name: t.ask.submit(3) })).toBeEnabled()
    // Full: another link and the unchecked friend are disabled.
    expect(screen.getByTestId('ask-add-link')).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Maryam' })).toBeDisabled()
    // Removing a link frees a slot.
    fireEvent.click(screen.getByRole('button', { name: t.ask.removeLink }))
    expect(screen.getByRole('button', { name: t.ask.submit(2) })).toBeInTheDocument()
  })

  it('submits members + links with the chosen question, then opens Telegram share for the first link', async () => {
    vi.mocked(api.asks.friends).mockResolvedValue({ friends: FRIENDS })
    vi.mocked(api.asks.create).mockResolvedValue({ ask: { ...ASK, total: 3 }, links: ['https://t.me/bot?startapp=ask_A', 'https://t.me/bot?startapp=ask_B'] })
    const onCreated = vi.fn()
    renderSheet({ onCreated })
    await screen.findByText('Negar')
    fireEvent.click(screen.getByRole('radio', { name: t.ask.questions.date }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Negar' }))
    fireEvent.click(screen.getByTestId('ask-add-link'))
    fireEvent.click(screen.getByTestId('ask-add-link'))
    fireEvent.click(screen.getByRole('button', { name: t.ask.submit(3) }))

    await waitFor(() => expect(api.asks.create).toHaveBeenCalledWith({
      targetId: 'target-1', question: 'date', memberIds: ['f1'], linkCount: 2,
    }))
    expect(onCreated).toHaveBeenCalled()
    await screen.findByTestId('ask-share-step')
    const url = vi.mocked(openTelegramLink).mock.calls[0][0]
    expect(url).toContain('https://t.me/share/url?url=' + encodeURIComponent('https://t.me/bot?startapp=ask_A'))
    expect(url).toContain('&text=')
    // Each link gets its own share + copy row.
    expect(screen.getAllByRole('button', { name: new RegExp(t.ask.shareButton) })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: t.ask.copyLink })).toHaveLength(2)
    expect(api.asks.event).toHaveBeenCalledWith(expect.objectContaining({ name: 'ask_sheet_submit' }))
  })

  it('copy link writes the raw link to the clipboard', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, { clipboard: { writeText } })
    vi.mocked(api.asks.create).mockResolvedValue({ ask: ASK, links: ['https://t.me/bot?startapp=ask_A'] })
    renderSheet()
    fireEvent.click(screen.getByTestId('ask-add-link'))
    fireEvent.click(screen.getByRole('button', { name: t.ask.submit(1) }))
    await screen.findByTestId('ask-share-step')
    fireEvent.click(screen.getByRole('button', { name: t.ask.copyLink }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://t.me/bot?startapp=ask_A'))
  })

  it('members only: no share step, closes with a toast', async () => {
    vi.mocked(api.asks.friends).mockResolvedValue({ friends: FRIENDS })
    vi.mocked(api.asks.create).mockResolvedValue({ ask: ASK, links: [] })
    const onClose = vi.fn()
    renderSheet({ onClose })
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Negar' }))
    fireEvent.click(screen.getByRole('button', { name: t.ask.submit(1) }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(openTelegramLink).not.toHaveBeenCalled()
    expect(window.Telegram!.WebApp!.showAlert).toHaveBeenCalledWith(t.ask.sentToast)
  })

  it('409 ask_exists hands the existing ask id to onExists', async () => {
    vi.mocked(api.asks.create).mockRejectedValue(
      Object.assign(new Error(JSON.stringify({ error: 'ask_exists', askId: 'ask-old' })), { status: 409 }),
    )
    const onExists = vi.fn()
    const onClose = vi.fn()
    renderSheet({ onExists, onClose })
    fireEvent.click(screen.getByTestId('ask-add-link'))
    fireEvent.click(screen.getByRole('button', { name: t.ask.submit(1) }))
    await waitFor(() => expect(onExists).toHaveBeenCalledWith('ask-old'))
    expect(onClose).toHaveBeenCalled()
  })

  it('429 shows the limit message', async () => {
    vi.mocked(api.asks.create).mockRejectedValue(Object.assign(new Error('{"error":"ask_limit"}'), { status: 429 }))
    renderSheet()
    fireEvent.click(screen.getByTestId('ask-add-link'))
    fireEvent.click(screen.getByRole('button', { name: t.ask.submit(1) }))
    await waitFor(() => expect(window.Telegram!.WebApp!.showAlert).toHaveBeenCalledWith(t.ask.limitReached))
  })

  it('edit mode removes a friend after a confirm and drops her from the selection', async () => {
    vi.mocked(api.asks.friends).mockResolvedValue({ friends: FRIENDS })
    renderSheet()
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Negar' }))
    expect(screen.getByRole('button', { name: t.ask.submit(1) })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: t.ask.editFriends }))
    fireEvent.click(screen.getByRole('button', { name: t.ask.removeFriendAria('Negar') }))
    expect(screen.getByText(t.ask.removeFriendConfirm('Negar'))).toBeInTheDocument()
    // "No" keeps her.
    fireEvent.click(screen.getByRole('button', { name: t.ask.removeFriendNo }))
    expect(api.asks.removeFriend).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: t.ask.removeFriendAria('Negar') }))
    fireEvent.click(screen.getByRole('button', { name: t.ask.removeFriendYes }))
    await waitFor(() => expect(screen.queryByText('Negar')).not.toBeInTheDocument())
    expect(api.asks.removeFriend).toHaveBeenCalledWith('f1')
    expect(screen.getByRole('button', { name: t.ask.submitEmpty })).toBeDisabled()
    // Back to picking.
    fireEvent.click(screen.getByRole('button', { name: t.ask.done }))
    expect(screen.getByRole('checkbox', { name: 'Maryam' })).toBeInTheDocument()
  })

  it('a failed removal keeps the friend', async () => {
    vi.mocked(api.asks.friends).mockResolvedValue({ friends: FRIENDS })
    vi.mocked(api.asks.removeFriend).mockRejectedValueOnce(Object.assign(new Error('{"error":"x"}'), { status: 500 }))
    renderSheet()
    await screen.findByText('Negar')
    fireEvent.click(screen.getByRole('button', { name: t.ask.editFriends }))
    fireEvent.click(screen.getByRole('button', { name: t.ask.removeFriendAria('Negar') }))
    fireEvent.click(screen.getByRole('button', { name: t.ask.removeFriendYes }))
    await waitFor(() => expect(window.Telegram!.WebApp!.showAlert).toHaveBeenCalled())
    expect(screen.getByText(t.ask.removeFriendConfirm('Negar'))).toBeInTheDocument()
  })
})
