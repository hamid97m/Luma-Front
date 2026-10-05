import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('../src/telegram.js', () => ({
  haptic: { impact: vi.fn(), selection: vi.fn(), notification: vi.fn() },
  isDarkTheme: () => false,
  setThemePref: vi.fn(),
  useBackButton: vi.fn(),
}))

import { SettingsSheet } from '../src/components/SettingsSheet.js'
import { api } from '../src/api.js'
import { useLocaleStore } from '../src/i18n.js'
import { fa } from '../src/locales/fa.js'
import { isLocalePending, setLocalePending } from '../src/i18n/locale.js'

const languageRow = () => screen.getByRole('button', { name: new RegExp(fa.language.settingsLabel) })

const renderSheet = () => render(<SettingsSheet isActive onPauseChange={vi.fn()} onClose={vi.fn()} />)

describe('SettingsSheet language row', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useLocaleStore.getState().setLocale('fa')
  })

  afterEach(() => {
    // Unmount before restoring the store so the reset doesn't re-render a live sheet outside act().
    cleanup()
    useLocaleStore.getState().setLocale('fa')
    setLocalePending(false)
  })

  it('is the first row, shows the current language, and opens the options', () => {
    renderSheet()
    const row = languageRow()
    expect(row).toHaveTextContent('فارسی')
    expect(row).toHaveAttribute('aria-expanded', 'false')

    // First item in the sheet: the heading's next sibling.
    const heading = screen.getByRole('heading', { name: fa.settings.title })
    expect(heading.nextElementSibling).toBe(row)

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    fireEvent.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'فارسی' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'false')
  })

  it('selecting a language updates the store and PATCHes the server', async () => {
    vi.mocked(api.profile.setLocale).mockResolvedValue({ ok: true, locale: 'en' })
    renderSheet()
    fireEvent.click(languageRow())
    fireEvent.click(screen.getByRole('radio', { name: 'English' }))

    expect(useLocaleStore.getState().locale).toBe('en')
    expect(localStorage.getItem('luma.locale')).toBe('en')
    await waitFor(() => expect(api.profile.setLocale).toHaveBeenCalledWith('en'))
    await waitFor(() => expect(isLocalePending()).toBe(false))
  })

  it('marks the locale pending before the PATCH resolves (guards the remount race)', async () => {
    let resolvePatch: (v: { ok: true; locale: 'en' }) => void = () => {}
    vi.mocked(api.profile.setLocale).mockReturnValue(
      new Promise((resolve) => {
        resolvePatch = resolve
      }),
    )
    renderSheet()
    fireEvent.click(languageRow())
    fireEvent.click(screen.getByRole('radio', { name: 'English' }))

    // Synchronously after the tap, before the network answers.
    expect(isLocalePending()).toBe(true)
    expect(useLocaleStore.getState().locale).toBe('en')
    expect(api.profile.setLocale).toHaveBeenCalledWith('en')

    resolvePatch({ ok: true, locale: 'en' })
    await waitFor(() => expect(isLocalePending()).toBe(false))
  })

  it('a failed PATCH keeps the new language and leaves it pending', async () => {
    vi.mocked(api.profile.setLocale).mockRejectedValue(new Error('offline'))
    renderSheet()
    fireEvent.click(languageRow())
    fireEvent.click(screen.getByRole('radio', { name: 'العربية' }))

    await waitFor(() => expect(api.profile.setLocale).toHaveBeenCalledWith('ar'))
    // Let the rejection settle; the flag must still be set.
    await new Promise((r) => setTimeout(r, 0))
    expect(isLocalePending()).toBe(true)
    expect(useLocaleStore.getState().locale).toBe('ar')
  })

  it('re-selecting the current language is a no-op', () => {
    renderSheet()
    fireEvent.click(languageRow())
    fireEvent.click(screen.getByRole('radio', { name: 'فارسی' }))

    expect(api.profile.setLocale).not.toHaveBeenCalled()
    expect(isLocalePending()).toBe(false)
    expect(useLocaleStore.getState().locale).toBe('fa')
  })

  it('deleting the account forgets the saved language so a re-signup sees the picker', async () => {
    vi.mocked(api.profile.delete).mockResolvedValue({ ok: true })
    setLocalePending(true)
    expect(localStorage.getItem('luma.locale')).toBe('fa')
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload: reloadMock } })

    renderSheet()
    fireEvent.click(screen.getByText(fa.settings.deleteAccount))
    fireEvent.click(screen.getByText(fa.settings.confirmDelete))

    await waitFor(() => expect(reloadMock).toHaveBeenCalled())
    expect(api.profile.delete).toHaveBeenCalled()
    expect(localStorage.getItem('luma.locale')).toBeNull()
    expect(isLocalePending()).toBe(false)
  })
})
