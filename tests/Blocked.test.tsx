import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Blocked } from '../src/screens/Blocked.js'
import { useLocaleStore } from '../src/i18n.js'

// These assertions use English copy; setup.ts pins Persian for the rest.
beforeEach(() => useLocaleStore.getState().setLocale('en'))
afterEach(() => useLocaleStore.getState().setLocale('fa'))

describe('Blocked', () => {
  it('deep-links to the support bot chat when the handle is known', () => {
    const openTelegramLink = vi.fn()
    window.Telegram!.WebApp!.openTelegramLink = openTelegramLink

    render(<Blocked supportBot="LumaBot" />)
    fireEvent.click(screen.getByRole('button', { name: /contact support/i }))

    expect(openTelegramLink).toHaveBeenCalledWith('https://t.me/LumaBot?start=support')
  })

  it('hides the support button when no bot handle is available', () => {
    render(<Blocked supportBot={null} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('Blocked (suspended)', () => {
  it('shows the temporary-suspension copy with the until date in Latin digits and keeps support', () => {
    useLocaleStore.getState().setLocale('fa')
    render(<Blocked supportBot="LumaBot" suspendedUntil="2026-12-01T10:30:00Z" />)

    expect(screen.getByRole('heading')).toHaveTextContent('حساب شما موقتاً تعلیق شده است')
    const body = screen.getByText(/موقتاً تعلیق شده است\./)
    expect(body.textContent).toMatch(/\d/)
    expect(body.textContent).not.toMatch(/[۰-۹٠-٩]/)
    expect(screen.getByRole('button', { name: 'تماس با پشتیبانی' })).toBeInTheDocument()
  })

  it('falls back to the ban copy without a suspension date', () => {
    render(<Blocked supportBot={null} />)
    expect(screen.getByRole('heading')).toHaveTextContent('Your account has been suspended')
  })
})
