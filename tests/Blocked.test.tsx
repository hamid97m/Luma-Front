import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Blocked } from '../src/screens/Blocked.js'

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
