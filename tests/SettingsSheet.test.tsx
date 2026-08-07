import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettingsSheet } from '../src/components/SettingsSheet.js'
import { api } from '../src/api.js'

vi.mock('../src/api.js', () => ({
  api: {
    auth: { verify: vi.fn() },
    profile: { get: vi.fn(), update: vi.fn(), delete: vi.fn() },
    photos: { getUploadUrl: vi.fn(), delete: vi.fn(), reorder: vi.fn(), uploadFile: vi.fn() },
    discovery: { feed: vi.fn() },
    swipes: { swipe: vi.fn() },
    matches: { list: vi.fn() },
  },
}))

// The pause control is one of two switches in the sheet; target it by name.
const pauseSwitch = () => screen.getByRole('switch', { name: 'Pause my account' })

describe('SettingsSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('calls onClose when the sheet is dismissed (Escape)', () => {
    const onClose = vi.fn()
    render(<SettingsSheet isActive={true} onPauseChange={vi.fn()} onClose={onClose} />)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('pauses the account and calls onPauseChange(false)', async () => {
    vi.mocked(api.profile.update).mockResolvedValue({} as any)
    const onPauseChange = vi.fn()
    render(<SettingsSheet isActive={true} onPauseChange={onPauseChange} onClose={vi.fn()} />)

    fireEvent.click(pauseSwitch())

    await waitFor(() => {
      expect(api.profile.update).toHaveBeenCalledWith({ is_active: false })
      expect(onPauseChange).toHaveBeenCalledWith(false)
    })
  })

  it('resumes a paused account and calls onPauseChange(true)', async () => {
    vi.mocked(api.profile.update).mockResolvedValue({} as any)
    const onPauseChange = vi.fn()
    render(<SettingsSheet isActive={false} onPauseChange={onPauseChange} onClose={vi.fn()} />)

    fireEvent.click(pauseSwitch())

    await waitFor(() => {
      expect(api.profile.update).toHaveBeenCalledWith({ is_active: true })
      expect(onPauseChange).toHaveBeenCalledWith(true)
    })
  })

  it('reflects the correct aria-checked state (checked means active/enabled, not paused)', () => {
    const { rerender } = render(<SettingsSheet isActive={true} onPauseChange={vi.fn()} onClose={vi.fn()} />)
    expect(pauseSwitch()).toHaveAttribute('aria-checked', 'true')

    rerender(<SettingsSheet isActive={false} onPauseChange={vi.fn()} onClose={vi.fn()} />)
    expect(pauseSwitch()).toHaveAttribute('aria-checked', 'false')
  })

  it('disables the pause toggle while the change is in flight', async () => {
    let resolveUpdate: (value?: unknown) => void = () => {}
    vi.mocked(api.profile.update).mockReturnValue(
      new Promise((resolve) => { resolveUpdate = resolve }) as any
    )
    render(<SettingsSheet isActive={true} onPauseChange={vi.fn()} onClose={vi.fn()} />)

    fireEvent.click(pauseSwitch())

    await waitFor(() => expect(pauseSwitch()).toBeDisabled())

    resolveUpdate({})

    await waitFor(() => expect(pauseSwitch()).not.toBeDisabled())
  })

  it('toggles dark theme and persists the preference', () => {
    render(<SettingsSheet isActive={true} onPauseChange={vi.fn()} onClose={vi.fn()} />)
    const darkSwitch = screen.getByRole('switch', { name: 'Dark theme' })
    fireEvent.click(darkSwitch)
    expect(localStorage.getItem('luma_theme')).toBe('dark')
    fireEvent.click(darkSwitch)
    expect(localStorage.getItem('luma_theme')).toBe('light')
  })

  it('shows a confirmation view before deleting, and cancel does not call delete', () => {
    render(<SettingsSheet isActive={true} onPauseChange={vi.fn()} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('Delete my account'))
    expect(screen.getByText('Delete your account?')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Delete your account?')).not.toBeInTheDocument()
    expect(api.profile.delete).not.toHaveBeenCalled()
  })

  it('deletes the account, clears the returning-user flag, and reloads on confirm', async () => {
    vi.mocked(api.profile.delete).mockResolvedValue({ ok: true })
    localStorage.setItem('luma_setup_complete_tg_id', '123')
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadMock },
    })

    render(<SettingsSheet isActive={true} onPauseChange={vi.fn()} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('Delete my account'))
    fireEvent.click(screen.getByText('Yes, delete my account'))

    await waitFor(() => {
      expect(api.profile.delete).toHaveBeenCalled()
      expect(localStorage.getItem('luma_setup_complete_tg_id')).toBeNull()
      expect(reloadMock).toHaveBeenCalled()
    })
  })
})
