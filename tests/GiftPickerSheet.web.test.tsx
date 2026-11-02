import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('../src/api.js', () => ({
  api: {
    gifts: { catalog: vi.fn(), checkout: vi.fn(), transaction: vi.fn() },
  },
}))
vi.mock('../src/telegram.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/telegram.js')>()),
  openInvoice: vi.fn(() => new Promise(() => {})),
}))

import { GiftPickerSheet } from '../src/components/gifts/GiftPickerSheet.js'
import { api } from '../src/api.js'
import { openInvoice } from '../src/telegram.js'
import { t } from '../src/i18n.js'

const GIFT = { giftId: 'g1', emoji: '🌹', chargedStars: 25 }
const TG_INIT_DATA = window.Telegram!.WebApp!.initData

function renderSheet() {
  return render(
    <GiftPickerSheet open onClose={() => {}} target={{ context: 'chat', matchId: 'm1' }} recipientName="Sara" />,
  )
}

describe('GiftPickerSheet: website vs Telegram', () => {
  beforeEach(() => {
    vi.mocked(api.gifts.catalog).mockReset().mockResolvedValue({ gifts: [GIFT] } as never)
    vi.mocked(api.gifts.checkout).mockReset().mockResolvedValue({ transactionId: 't1', invoiceLink: 'https://t.me/$inv' } as never)
    vi.mocked(openInvoice).mockClear()
  })

  afterEach(() => {
    ;(window.Telegram!.WebApp! as { initData: string }).initData = TG_INIT_DATA
  })

  it('outside Telegram shows webUnavailable and never starts a checkout', async () => {
    ;(window.Telegram!.WebApp! as { initData: string }).initData = ''
    renderSheet()

    expect(screen.getByText(t.gifts.webUnavailable)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('25')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: t.gifts.selectPrompt })).not.toBeInTheDocument()
    expect(api.gifts.checkout).not.toHaveBeenCalled()
    expect(openInvoice).not.toHaveBeenCalled()
  })

  it('inside Telegram the picker and checkout are unchanged', async () => {
    renderSheet()

    expect(screen.queryByText(t.gifts.webUnavailable)).not.toBeInTheDocument()
    fireEvent.click(await screen.findByText('25'))
    fireEvent.click(screen.getByRole('button', { name: t.gifts.send('🌹', 25) }))

    await waitFor(() => expect(openInvoice).toHaveBeenCalledWith('https://t.me/$inv'))
    expect(api.gifts.checkout).toHaveBeenCalledWith({ context: 'chat', matchId: 'm1', giftId: 'g1', note: undefined })
  })
})
