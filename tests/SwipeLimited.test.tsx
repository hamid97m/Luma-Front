import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SwipeLimited } from '../src/components/SwipeLimited.js'

describe('SwipeLimited', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders the countdown, copy, and premium pitch', () => {
    const resetAt = new Date(Date.now() + 2 * 3600_000).toISOString() // 2h left
    render(<SwipeLimited resetAt={resetAt} onExpired={vi.fn()} onGetPremium={vi.fn()} />)

    expect(screen.getByText("You're out of likes")).toBeInTheDocument()
    expect(screen.getByText('02:00:00')).toBeInTheDocument()
    expect(screen.getByText('until refill')).toBeInTheDocument()
    expect(screen.getByText('Swipe without limits')).toBeInTheDocument()
  })

  it('ticks the countdown every second', () => {
    const resetAt = new Date(Date.now() + 2 * 3600_000).toISOString()
    render(<SwipeLimited resetAt={resetAt} onExpired={vi.fn()} onGetPremium={vi.fn()} />)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.getByText('01:59:59')).toBeInTheDocument()
  })

  it('calls onGetPremium when the button is pressed', () => {
    const onGetPremium = vi.fn()
    const resetAt = new Date(Date.now() + 3600_000).toISOString()
    render(<SwipeLimited resetAt={resetAt} onExpired={vi.fn()} onGetPremium={onGetPremium} />)

    fireEvent.click(screen.getByText('Get Premium'))
    expect(onGetPremium).toHaveBeenCalled()
  })

  it('calls onExpired once when the timer crosses zero', () => {
    const onExpired = vi.fn()
    const resetAt = new Date(Date.now() + 2000).toISOString()
    render(<SwipeLimited resetAt={resetAt} onExpired={onExpired} onGetPremium={vi.fn()} />)

    expect(onExpired).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(3000) })
    expect(onExpired).toHaveBeenCalledTimes(1)
  })
})
