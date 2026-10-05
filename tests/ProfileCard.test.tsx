import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProfileCard } from '../src/components/ProfileCard.js'
import type { DiscoveryProfile } from '../src/types.js'

const profile: DiscoveryProfile = {
  id: 'p1',
  name: 'Sara',
  age: 27,
  bio: null,
  telegramId: 1,
  photos: [],
  interests: [],
  location: null,
}

describe('ProfileCard premium badge', () => {
  it('shows the premium badge only for premium profiles', () => {
    const { rerender } = render(
      <ProfileCard profile={{ ...profile, premium: true }} photoIdx={0} onReport={() => {}} onGiftClick={() => {}} />,
    )
    expect(screen.getByRole('img', { name: 'پرمیوم' })).toBeInTheDocument()

    rerender(
      <ProfileCard profile={{ ...profile, premium: false }} photoIdx={0} onReport={() => {}} onGiftClick={() => {}} />,
    )
    expect(screen.queryByRole('img', { name: 'پرمیوم' })).not.toBeInTheDocument()
  })
})
