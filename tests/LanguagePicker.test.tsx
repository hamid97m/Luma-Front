import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../src/telegram.js', () => ({
  haptic: { impact: vi.fn(), selection: vi.fn(), notification: vi.fn() },
  mainButtonSupported: () => false,
  useMainButton: vi.fn(),
  useBackButton: vi.fn(),
}))

import { LanguagePicker } from '../src/screens/LanguagePicker.js'
import { useLocaleStore } from '../src/i18n.js'
import { haptic } from '../src/telegram.js'
import { fa } from '../src/locales/fa.js'
import { en } from '../src/locales/en.js'
import { ar } from '../src/locales/ar.js'

describe('LanguagePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useLocaleStore.getState().setLocale('fa')
  })
  afterEach(() => useLocaleStore.getState().setLocale('fa'))

  it('renders the three native names as a radio group in their own script direction', () => {
    render(<LanguagePicker onDone={vi.fn()} />)
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.textContent)).toEqual(['فارسی', 'English', 'العربية'])
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('dir', 'ltr')
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('lang', 'en')
    expect(screen.getByRole('radio', { name: 'العربية' })).toHaveAttribute('dir', 'rtl')
    expect(screen.getByRole('radio', { name: 'فارسی' })).toHaveAttribute('dir', 'rtl')
  })

  it('preselects the store locale (Telegram-mapped default) and previews in it', () => {
    // The store is initialised from Telegram's language_code at boot (see
    // detectInitialLocale); here we set the resulting store value directly.
    useLocaleStore.setState({ locale: 'ar' })
    render(<LanguagePicker onDone={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'العربية' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'فارسی' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(ar.language.title)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ar.language.continue })).toBeInTheDocument()
  })

  it('tapping a row switches the preview without committing; Continue persists and calls onDone', () => {
    const onDone = vi.fn()
    render(<LanguagePicker onDone={onDone} />)
    expect(screen.getByText(fa.language.title)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'English' }))
    expect(haptic.selection).toHaveBeenCalled()
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'فارسی' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(en.language.title)).toBeInTheDocument()
    // Preview only — nothing is committed until Continue, so the (keyed) App
    // doesn't remount under the picker on every tap.
    expect(useLocaleStore.getState().locale).toBe('fa')
    expect(localStorage.getItem('luma.locale')).toBe('fa')
    expect(onDone).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: en.language.continue }))
    expect(useLocaleStore.getState().locale).toBe('en')
    expect(localStorage.getItem('luma.locale')).toBe('en')
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('Continue with the preselected locale still persists it and calls onDone', () => {
    const onDone = vi.fn()
    localStorage.clear()
    render(<LanguagePicker onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: fa.language.continue }))
    expect(localStorage.getItem('luma.locale')).toBe('fa')
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
