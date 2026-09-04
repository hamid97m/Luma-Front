import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DirectChatSheet } from '../src/components/premium/DirectChatSheet.js'
import { t } from '../src/i18n.js'

const base = {
  open: true, onClose: vi.fn(), recipientName: 'Sara',
  remaining: 2, resetAt: null, starting: false,
  onStart: vi.fn(), onGoPremium: vi.fn(),
}

describe('DirectChatSheet', () => {
  it('paywall mode shows the go-premium CTA', () => {
    render(<DirectChatSheet {...base} mode="paywall" />)
    expect(screen.getByText(t.directChat.goPremiumCta)).toBeInTheDocument()
    expect(screen.queryByText(t.directChat.startCta)).not.toBeInTheDocument()
  })

  it('confirm mode shows the start CTA and remaining count, and fires onStart', () => {
    const onStart = vi.fn()
    render(<DirectChatSheet {...base} mode="confirm" remaining={2} onStart={onStart} />)
    expect(screen.getByText(t.directChat.remaining(2))).toBeInTheDocument()
    screen.getByText(t.directChat.startCta).click()
    expect(onStart).toHaveBeenCalled()
  })

  it('limit mode shows the limit title and no start CTA', () => {
    render(<DirectChatSheet {...base} mode="limit" resetAt={new Date(Date.now() + 3600_000).toISOString()} />)
    expect(screen.getByText(t.directChat.limitTitle)).toBeInTheDocument()
    expect(screen.queryByText(t.directChat.startCta)).not.toBeInTheDocument()
  })
})
