import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/api.js', () => ({
  api: { blocks: { create: vi.fn() } },
}))
vi.mock('../src/telegram.js', () => ({
  haptic: { impact: vi.fn(), selection: vi.fn(), notification: vi.fn() },
  useBackButton: vi.fn(),
}))

import { api } from '../src/api.js'
import { t } from '../src/i18n.js'
import { BlockSheet } from '../src/components/BlockSheet.js'

const NAME = 'Sara'
const USER_ID = 'u-2'

describe('BlockSheet', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the person name in the title and confirm button', () => {
    render(<BlockSheet open name={NAME} userId={USER_ID} onClose={vi.fn()} onBlocked={vi.fn()} />)
    expect(screen.getByText(t.block.title(NAME))).toBeInTheDocument()
    expect(screen.getByText(t.block.body)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.block.confirm(NAME) })).toBeInTheDocument()
  })

  it('confirming blocks the user then calls onBlocked', async () => {
    vi.mocked(api.blocks.create).mockResolvedValue({ ok: true })
    const onBlocked = vi.fn()
    render(<BlockSheet open name={NAME} userId={USER_ID} onClose={vi.fn()} onBlocked={onBlocked} />)

    await userEvent.click(screen.getByRole('button', { name: t.block.confirm(NAME) }))

    await waitFor(() => expect(api.blocks.create).toHaveBeenCalledWith(USER_ID))
    await waitFor(() => expect(onBlocked).toHaveBeenCalled())
  })

  it('cancel closes without blocking', async () => {
    const onClose = vi.fn()
    const onBlocked = vi.fn()
    render(<BlockSheet open name={NAME} userId={USER_ID} onClose={onClose} onBlocked={onBlocked} />)

    await userEvent.click(screen.getByRole('button', { name: t.block.cancel }))

    expect(onClose).toHaveBeenCalled()
    expect(api.blocks.create).not.toHaveBeenCalled()
    expect(onBlocked).not.toHaveBeenCalled()
  })

  it('keeps the sheet open and does not call onBlocked when the request fails', async () => {
    vi.mocked(api.blocks.create).mockRejectedValue(new Error('boom'))
    const onBlocked = vi.fn()
    render(<BlockSheet open name={NAME} userId={USER_ID} onClose={vi.fn()} onBlocked={onBlocked} />)

    await userEvent.click(screen.getByRole('button', { name: t.block.confirm(NAME) }))

    await waitFor(() => expect(api.blocks.create).toHaveBeenCalled())
    expect(onBlocked).not.toHaveBeenCalled()
    expect(screen.getByText(t.block.title(NAME))).toBeInTheDocument()
  })
})
