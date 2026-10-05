import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('../src/telegram.js', () => ({
  haptic: { impact: vi.fn(), selection: vi.fn(), notification: vi.fn() },
  mainButtonSupported: () => false,
  useMainButton: vi.fn(),
  useBackButton: vi.fn(),
}))

vi.mock('../src/i18n/geo.js', () => ({
  geoCountrySync: vi.fn(() => null),
  prefetchGeoCountry: vi.fn(() => Promise.resolve(null)),
}))

import { LanguagePicker } from '../src/screens/LanguagePicker.js'
import { useLocaleStore } from '../src/i18n.js'
import { geoCountrySync, prefetchGeoCountry } from '../src/i18n/geo.js'
import { haptic } from '../src/telegram.js'
import { fa } from '../src/locales/fa.js'
import { en } from '../src/locales/en.js'
import { ar } from '../src/locales/ar.js'

const tgUser = () => window.Telegram!.WebApp!.initDataUnsafe.user as { language_code?: string }
const setTelegramLang = (code: string | undefined) => {
  if (code === undefined) delete tgUser().language_code
  else tgUser().language_code = code
}

describe('LanguagePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(geoCountrySync).mockReturnValue(null)
    vi.mocked(prefetchGeoCountry).mockResolvedValue(null)
    localStorage.clear()
    useLocaleStore.getState().setLocale('fa')
    setTelegramLang('fa')
  })
  afterEach(() => {
    useLocaleStore.getState().setLocale('fa')
    setTelegramLang(undefined)
  })

  it('renders the three native names with flags as a radio group in their own script direction', () => {
    render(<LanguagePicker onDone={vi.fn()} />)
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    // Flags are decorative (aria-hidden) — the accessible name is the native name alone.
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toHaveLength(3)
    expect(screen.getByRole('radio', { name: 'فارسی' })).toHaveTextContent('🇮🇷')
    expect(screen.getByRole('radio', { name: 'English' })).toHaveTextContent('🇬🇧')
    expect(screen.getByRole('radio', { name: 'العربية' })).toHaveTextContent('🇸🇦')
    // The label (not the row) carries lang/dir so the check column stays aligned.
    expect(screen.getByText('English')).toHaveAttribute('dir', 'ltr')
    expect(screen.getByText('English')).toHaveAttribute('lang', 'en')
    expect(screen.getByText('العربية')).toHaveAttribute('dir', 'rtl')
    expect(screen.getByText('فارسی')).toHaveAttribute('dir', 'rtl')
    expect(screen.getByRole('radio', { name: 'English' })).not.toHaveAttribute('dir')
  })

  it('preselects from Telegram language_code and previews in it', () => {
    setTelegramLang('ar')
    render(<LanguagePicker onDone={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'العربية' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'فارسی' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(ar.language.title)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ar.language.continue })).toBeInTheDocument()
  })

  it('falls back to the IP country when Telegram is English (sync result)', () => {
    setTelegramLang('en')
    vi.mocked(geoCountrySync).mockReturnValue('IR')
    render(<LanguagePicker onDone={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'فارسی' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(fa.language.title)).toBeInTheDocument()
  })

  it('adopts a late IP-country answer unless the user already tapped a row', async () => {
    setTelegramLang('en')
    let resolveGeo!: (c: string | null) => void
    vi.mocked(prefetchGeoCountry).mockReturnValue(new Promise((r) => { resolveGeo = r }))
    const { unmount } = render(<LanguagePicker onDone={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true')
    await act(async () => { resolveGeo('AE') })
    expect(screen.getByRole('radio', { name: 'العربية' })).toHaveAttribute('aria-checked', 'true')
    unmount()

    // Second mount: user taps before the answer arrives → their pick stands.
    vi.mocked(prefetchGeoCountry).mockReturnValue(new Promise((r) => { resolveGeo = r }))
    render(<LanguagePicker onDone={vi.fn()} />)
    fireEvent.click(screen.getByRole('radio', { name: 'فارسی' }))
    await act(async () => { resolveGeo('AE') })
    expect(screen.getByRole('radio', { name: 'فارسی' })).toHaveAttribute('aria-checked', 'true')
  })

  it('Telegram English + unknown country → English', () => {
    setTelegramLang('en')
    render(<LanguagePicker onDone={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true')
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
