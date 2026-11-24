import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CardStack } from '../src/components/CardStack.js'
import type { DiscoveryProfile } from '../src/types.js'

vi.mock('../src/api.js', () => ({ api: { asks: { event: vi.fn() } } }))

const profiles: DiscoveryProfile[] = [
  { id: 'p1', name: 'Sara', age: 24, bio: null, telegramId: 1, photos: ['https://img1'], interests: [], location: null },
]

const renderStack = (props: Partial<React.ComponentProps<typeof CardStack>> = {}) =>
  render(<CardStack profiles={profiles} onLike={() => {}} onPass={() => {}} disabled={false} onGiftClick={() => {}} {...props} />)

describe('gift tooltip (men)', () => {
  beforeEach(() => localStorage.clear())

  it('shows the hint until the gift button is tapped, then never again', () => {
    const onGiftClick = vi.fn()
    const { unmount } = renderStack({ giftHint: true, onGiftClick })
    expect(screen.getByTestId('gift-tooltip')).toHaveTextContent('یه هدیه کوچیک شانستو میبره بالاتر')

    fireEvent.click(screen.getByTestId('gift-tooltip'))
    expect(onGiftClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('gift-tooltip')).not.toBeInTheDocument()

    unmount()
    renderStack({ giftHint: true })
    expect(screen.queryByTestId('gift-tooltip')).not.toBeInTheDocument()
  })

  it('is hidden when giftHint is off (women / non-men)', () => {
    renderStack({ giftHint: false })
    expect(screen.queryByTestId('gift-tooltip')).not.toBeInTheDocument()
  })

  it('is hidden on the ask-a-friend layout', () => {
    renderStack({ giftHint: true, onAskClick: () => {} })
    expect(screen.queryByTestId('gift-tooltip')).not.toBeInTheDocument()
  })
})
