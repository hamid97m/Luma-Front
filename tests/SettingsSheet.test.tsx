import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettingsSheet } from '../src/components/SettingsSheet.js'
import { api } from '../src/api.js'
import { fa } from '../src/locales/fa.js'

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
const pauseSwitch = () => screen.getByRole('switch', { name: fa.settings.pause })

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
    const darkSwitch = screen.getByRole('switch', { name: fa.settings.darkTheme })
    fireEvent.click(darkSwitch)
    expect(localStorage.getItem('luma_theme')).toBe('dark')
    fireEvent.click(darkSwitch)
    expect(localStorage.getItem('luma_theme')).toBe('light')
  })

  it('shows a confirmation view before deleting, and cancel does not call delete', () => {
    render(<SettingsSheet isActive={true} onPauseChange={vi.fn()} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText(fa.settings.deleteAccount))
    fireEvent.click(screen.getByText(fa.settings.reasonSkip))
    expect(screen.getByText(fa.settings.confirmTitle)).toBeInTheDocument()

    // Cancel steps back to the reason survey, not straight to the menu.
    fireEvent.click(screen.getByText(fa.settings.cancel))
    expect(screen.queryByText(fa.settings.confirmTitle)).not.toBeInTheDocument()
    expect(screen.getByText(fa.settings.reasonTitle)).toBeInTheDocument()
    expect(api.profile.delete).not.toHaveBeenCalled()
  })

  it('shows the reason survey after "Delete account"; Continue is disabled until a reason is picked', () => {
    render(<SettingsSheet isActive={true} onPauseChange={vi.fn()} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText(fa.settings.deleteAccount))
    expect(screen.getByText(fa.settings.reasonTitle)).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(9)
    const cont = screen.getByRole('button', { name: fa.settings.reasonContinue })
    expect(cont).toBeDisabled()
    // The note box only appears once a reason is chosen.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: fa.settings.reasons.buggy }))
    expect(screen.getByRole('radio', { name: fa.settings.reasons.buggy })).toHaveAttribute('aria-checked', 'true')
    expect(cont).not.toBeDisabled()
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '500')

    // Cancel on the survey returns to the menu.
    fireEvent.click(screen.getByText(fa.settings.cancel))
    expect(screen.getByText(fa.settings.deleteAccount)).toBeInTheDocument()
  })

  it('sends the chosen reason and note with the delete', async () => {
    vi.mocked(api.profile.delete).mockResolvedValue({ ok: true })
    render(<SettingsSheet isActive={true} onPauseChange={vi.fn()} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText(fa.settings.deleteAccount))
    fireEvent.click(screen.getByRole('radio', { name: fa.settings.reasons.no_replies }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  nobody answers  ' } })
    fireEvent.click(screen.getByRole('button', { name: fa.settings.reasonContinue }))
    // Only the found_someone answer gets the congrats line.
    expect(screen.queryByText(fa.settings.congrats)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(fa.settings.confirmDelete))

    await waitFor(() =>
      expect(api.profile.delete).toHaveBeenCalledWith({ reason: 'no_replies', note: 'nobody answers' }),
    )
  })

  it('omits an empty note', async () => {
    vi.mocked(api.profile.delete).mockResolvedValue({ ok: true })
    render(<SettingsSheet isActive={true} onPauseChange={vi.fn()} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText(fa.settings.deleteAccount))
    fireEvent.click(screen.getByRole('radio', { name: fa.settings.reasons.taking_break }))
    fireEvent.click(screen.getByRole('button', { name: fa.settings.reasonContinue }))
    fireEvent.click(screen.getByText(fa.settings.confirmDelete))

    await waitFor(() => expect(api.profile.delete).toHaveBeenCalledWith({ reason: 'taking_break' }))
  })

  it('Skip deletes without a reason', async () => {
    vi.mocked(api.profile.delete).mockResolvedValue({ ok: true })
    render(<SettingsSheet isActive={true} onPauseChange={vi.fn()} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText(fa.settings.deleteAccount))
    // A reason picked and then skipped is discarded.
    fireEvent.click(screen.getByRole('radio', { name: fa.settings.reasons.other }))
    fireEvent.click(screen.getByText(fa.settings.reasonSkip))
    fireEvent.click(screen.getByText(fa.settings.confirmDelete))

    await waitFor(() => expect(api.profile.delete).toHaveBeenCalledWith(undefined))
  })

  it('congratulates users leaving because they met someone', () => {
    render(<SettingsSheet isActive={true} onPauseChange={vi.fn()} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText(fa.settings.deleteAccount))
    fireEvent.click(screen.getByRole('radio', { name: fa.settings.reasons.found_someone }))
    fireEvent.click(screen.getByRole('button', { name: fa.settings.reasonContinue }))

    expect(screen.getByText(fa.settings.congrats)).toBeInTheDocument()
    expect(screen.getByText(fa.settings.confirmTitle)).toBeInTheDocument()
  })

  it('deletes the account and closes the Mini App (no reload) inside Telegram', async () => {
    vi.mocked(api.profile.delete).mockResolvedValue({ ok: true })
    localStorage.setItem('luma_setup_complete_tg_id', '123')
    const close = vi.fn()
    ;(window as any).Telegram = { WebApp: { initData: 'query_id=1', close } }
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadMock },
    })

    render(<SettingsSheet isActive={true} onPauseChange={vi.fn()} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText(fa.settings.deleteAccount))
    fireEvent.click(screen.getByText(fa.settings.reasonSkip))
    fireEvent.click(screen.getByText(fa.settings.confirmDelete))

    await waitFor(() => {
      expect(api.profile.delete).toHaveBeenCalled()
      expect(localStorage.getItem('luma_setup_complete_tg_id')).toBeNull()
      expect(close).toHaveBeenCalled()
    })
    expect(reloadMock).not.toHaveBeenCalled()
    delete (window as any).Telegram
  })

  it('deletes the account and signs out (token cleared) on the website', async () => {
    vi.mocked(api.profile.delete).mockResolvedValue({ ok: true })
    localStorage.setItem('luma_session', 'tok')
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadMock },
    })

    render(<SettingsSheet isActive={true} onPauseChange={vi.fn()} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText(fa.settings.deleteAccount))
    fireEvent.click(screen.getByText(fa.settings.reasonSkip))
    fireEvent.click(screen.getByText(fa.settings.confirmDelete))

    await waitFor(() => {
      expect(api.profile.delete).toHaveBeenCalled()
      expect(localStorage.getItem('luma_session')).toBeNull()
      expect(reloadMock).toHaveBeenCalled()
    })
  })
})
