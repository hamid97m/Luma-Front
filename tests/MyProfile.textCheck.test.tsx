import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MyProfile } from '../src/screens/MyProfile.js'
import { api } from '../src/api.js'
import { t } from '../src/i18n.js'
import { useAuthStore } from '../src/store.js'

const PROFILE = {
  id: 'u1', name: 'Ali', age: 25, gender: 'man' as const, looking_for: 'women' as const,
  bio: 'Old bio', interests: [], location: 'Tehran',
  icebreaker_prompt: null as string | null, icebreaker_answer: 'Old answer',
  is_active: true, photos: [], setupComplete: true,
}

const rejected = (field: string, reason: string) =>
  Object.assign(new Error(JSON.stringify({ error: 'profile_text_rejected', field, reason })), { status: 422 })

async function renderLoaded() {
  vi.mocked(api.profile.get).mockResolvedValue(PROFILE as never)
  render(<MyProfile onOpenSupport={vi.fn()} />)
  await waitFor(() => expect(screen.getByDisplayValue('Old bio')).toBeTruthy())
}

describe('MyProfile profile-text check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null })
  })

  it('shows a bio rejection under the bio, keeps the text, and clears it on edit', async () => {
    vi.mocked(api.profile.update).mockRejectedValue(rejected('bio', 'contact_info'))
    await renderLoaded()
    const bio = screen.getByPlaceholderText(t.profile.aboutPlaceholder)
    fireEvent.change(bio, { target: { value: 'insta: ali_99' } })
    fireEvent.blur(bio)

    const msg = 'آیدی، شماره تلفن یا لینک در بیو مجاز نیست. لطفاً حذفش کن.'
    expect(await screen.findByText(msg)).toBeTruthy()
    expect(bio).toHaveValue('insta: ali_99')

    fireEvent.change(bio, { target: { value: 'I love hiking' } })
    expect(screen.queryByText(msg)).toBeNull()
  })

  it('shows a name rejection under the name', async () => {
    vi.mocked(api.profile.update).mockRejectedValue(rejected('name', 'fake_name'))
    await renderLoaded()
    const name = screen.getByDisplayValue('Ali')
    fireEvent.change(name, { target: { value: 'Shakira' } })
    fireEvent.blur(name)

    expect(await screen.findByText('این اسم واقعی به نظر نمی‌رسه. لطفاً اسم واقعی خودت رو بنویس.')).toBeTruthy()
    expect(name).toHaveValue('Shakira')
  })

  it('shows an icebreaker answer rejection under the answer', async () => {
    vi.mocked(api.profile.update).mockRejectedValue(rejected('icebreaker_answer', 'sexual'))
    await renderLoaded()
    const answer = screen.getByPlaceholderText(t.myProfile.answerPlaceholder)
    fireEvent.change(answer, { target: { value: 'something bad' } })
    fireEvent.blur(answer)

    expect(await screen.findByText('جواب سؤال شامل محتوای نامناسب است. لطفاً ویرایشش کن.')).toBeTruthy()
  })

  it('shows the limit message under the field being saved', async () => {
    vi.mocked(api.profile.update).mockRejectedValue(
      Object.assign(new Error(JSON.stringify({ error: 'profile_text_check_limit' })), { status: 429 }),
    )
    await renderLoaded()
    const bio = screen.getByPlaceholderText(t.profile.aboutPlaceholder)
    fireEvent.change(bio, { target: { value: 'new' } })
    fireEvent.blur(bio)
    expect(await screen.findByText('تلاش‌های زیادی انجام دادی. کمی بعد دوباره امتحان کن.')).toBeTruthy()
  })

  it('stays silent on other save errors', async () => {
    vi.mocked(api.profile.update).mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }))
    await renderLoaded()
    const bio = screen.getByPlaceholderText(t.profile.aboutPlaceholder)
    fireEvent.change(bio, { target: { value: 'new' } })
    fireEvent.blur(bio)
    await waitFor(() => expect(api.profile.update).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
