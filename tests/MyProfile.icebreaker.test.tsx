import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MyProfile } from '../src/screens/MyProfile.js'
import { api } from '../src/api.js'
import { t } from '../src/i18n.js'
import { useAuthStore } from '../src/store.js'

const PROFILE = {
  id: 'u1', name: 'Ali', age: 25, gender: 'man' as const, looking_for: 'women' as const,
  bio: null, interests: [], location: null,
  icebreaker_prompt: null as string | null, icebreaker_answer: null as string | null,
  is_active: true, photos: [], setupComplete: true,
}

async function renderLoaded(profile: typeof PROFILE) {
  vi.mocked(api.profile.get).mockResolvedValue(profile as never)
  render(<MyProfile onOpenSupport={vi.fn()} />)
  await waitFor(() => expect(api.profile.get).toHaveBeenCalled())
  const textarea = await screen.findByPlaceholderText(t.myProfile.answerPlaceholder)
  await waitFor(() => expect(textarea).toHaveValue(profile.icebreaker_answer ?? ''))
  return textarea
}

describe('MyProfile icebreaker saving', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null })
    vi.mocked(api.profile.update).mockResolvedValue({} as never)
  })

  it('saves the displayed default prompt together with the answer on blur', async () => {
    const textarea = await renderLoaded(PROFILE)

    fireEvent.change(textarea, { target: { value: '  Coffee and a long walk  ' } })
    fireEvent.blur(textarea)

    expect(api.profile.update).toHaveBeenCalledWith({
      icebreaker_prompt: t.icebreakers[0].prompt,
      icebreaker_answer: 'Coffee and a long walk',
    })
  })

  it('saves the stored prompt (not the default) together with the answer on blur', async () => {
    const stored = t.icebreakers[3].prompt
    const textarea = await renderLoaded({ ...PROFILE, icebreaker_prompt: stored, icebreaker_answer: 'Old' })

    fireEvent.change(textarea, { target: { value: 'New' } })
    fireEvent.blur(textarea)

    expect(api.profile.update).toHaveBeenCalledWith({ icebreaker_prompt: stored, icebreaker_answer: 'New' })
  })

  it('picking a prompt still saves just the prompt', async () => {
    await renderLoaded(PROFILE)

    fireEvent.click(screen.getByText(t.icebreakers[0].prompt))
    fireEvent.click(await screen.findByText(t.icebreakers[5].prompt))

    expect(api.profile.update).toHaveBeenCalledWith({ icebreaker_prompt: t.icebreakers[5].prompt })
  })
})
