import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BottomNav } from '../src/components/BottomNav.js'

describe('BottomNav', () => {
  it('shows no badge when matchesBadge is 0 or undefined', () => {
    render(<BottomNav active="discovery" onChange={vi.fn()} />)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('shows a badge with the count when matchesBadge is greater than 0', () => {
    render(<BottomNav active="discovery" onChange={vi.fn()} matchesBadge={3} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('does not render a badge when matchesBadge is explicitly 0', () => {
    render(<BottomNav active="matches" onChange={vi.fn()} matchesBadge={0} />)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})
