import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MyProfile } from '../src/screens/MyProfile.js'
import { api } from '../src/api.js'

vi.mock('../src/api.js', () => ({
  api: {
    auth: { verify: vi.fn() },
    profile: { get: vi.fn(), update: vi.fn(), delete: vi.fn() },
    photos: { getUploadUrl: vi.fn(), delete: vi.fn(), reorder: vi.fn(), uploadFile: vi.fn() },
    discovery: { feed: vi.fn() },
    swipes: { swipe: vi.fn() },
    matches: { list: vi.fn() },
  },
}))

const PROFILE = {
  id: 'u1', name: 'Ali', age: 25, gender: 'man' as const, looking_for: 'women' as const,
  bio: null, interests: [], location: null,
  icebreaker_prompt: null, icebreaker_answer: null,
  is_active: true, photos: [], setupComplete: true,
}

describe('MyProfile settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens the settings sheet when the gear icon is clicked', async () => {
    vi.mocked(api.profile.get).mockResolvedValue(PROFILE as any)
    render(<MyProfile />)

    await waitFor(() => screen.getByText('My Profile 👤'))
    fireEvent.click(screen.getByLabelText('Settings'))

    expect(screen.getByText('Pause my account')).toBeInTheDocument()
  })

  it('closes the settings sheet when its close button is clicked', async () => {
    vi.mocked(api.profile.get).mockResolvedValue(PROFILE as any)
    render(<MyProfile />)

    await waitFor(() => screen.getByText('My Profile 👤'))
    fireEvent.click(screen.getByLabelText('Settings'))
    fireEvent.click(screen.getByLabelText('Close'))

    expect(screen.queryByText('Pause my account')).not.toBeInTheDocument()
  })
})
