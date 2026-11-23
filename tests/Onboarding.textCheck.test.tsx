import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../src/api.js'

const EDITED = new File(['e'], 'photo.jpg', { type: 'image/jpeg' })
vi.mock('../src/components/PhotoEditor.js', () => ({
  PhotoEditor: (props: { onConfirm: (file: File) => void }) => (
    <button data-testid="editor-confirm" onClick={() => props.onConfirm(EDITED)}>editor</button>
  ),
}))

import { Onboarding } from '../src/screens/Onboarding.js'

const rejected = (field: string, reason: string) =>
  Object.assign(new Error(JSON.stringify({ error: 'profile_text_rejected', field, reason })), { status: 422 })
const FAKE_NAME_MSG = 'این اسم واقعی به نظر نمی‌رسه. لطفاً اسم واقعی خودت رو بنویس.'
const CITY_Q = 'کدوم شهر زندگی می‌کنی؟'
const clickContinue = () => fireEvent.click(screen.getByRole('button', { name: 'ادامه' }))

describe('Onboarding profile-text check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.profile.checkText).mockResolvedValue({ ok: true })
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
  })

  it('checks the trimmed name and moves on when it is approved', async () => {
    render(<Onboarding onComplete={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('تینا'), { target: { value: '  Sara ' } })
    clickContinue()
    expect(await screen.findByRole('heading', { name: CITY_Q })).toBeTruthy()
    expect(api.profile.checkText).toHaveBeenCalledWith('name', 'Sara')
  })

  it('stays on the name step and shows the reason on a 422, clearing it on edit', async () => {
    vi.mocked(api.profile.checkText).mockRejectedValue(rejected('name', 'fake_name'))
    render(<Onboarding onComplete={vi.fn()} />)
    const input = screen.getByPlaceholderText('تینا')
    fireEvent.change(input, { target: { value: 'Admin' } })
    clickContinue()

    expect(await screen.findByText(FAKE_NAME_MSG)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: CITY_Q })).toBeNull()
    expect(input).toHaveValue('Admin')

    fireEvent.change(input, { target: { value: 'Sara' } })
    expect(screen.queryByText(FAKE_NAME_MSG)).toBeNull()
  })

  it('shows the limit message on a 429', async () => {
    vi.mocked(api.profile.checkText).mockRejectedValue(
      Object.assign(new Error(JSON.stringify({ error: 'profile_text_check_limit' })), { status: 429 }),
    )
    render(<Onboarding onComplete={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('تینا'), { target: { value: 'Sara' } })
    clickContinue()
    expect(await screen.findByText('تلاش‌های زیادی انجام دادی. کمی بعد دوباره امتحان کن.')).toBeTruthy()
  })

  it('fails open on a network or server error', async () => {
    vi.mocked(api.profile.checkText).mockRejectedValue(Object.assign(new Error('boom'), { status: 502 }))
    render(<Onboarding onComplete={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('تینا'), { target: { value: 'Sara' } })
    clickContinue()
    expect(await screen.findByRole('heading', { name: CITY_Q })).toBeTruthy()
  })

  async function finishSignup(container: HTMLElement) {
    fireEvent.change(screen.getByPlaceholderText('تینا'), { target: { value: 'Sara' } })
    clickContinue()
    fireEvent.change(await screen.findByPlaceholderText('تهران'), { target: { value: 'شیراز' } })
    clickContinue()
    fireEvent.change(screen.getByPlaceholderText('25'), { target: { value: '25' } })
    clickContinue()
    fireEvent.click(screen.getByText('زن'))
    clickContinue()
    fireEvent.click(screen.getByText('همه'))
    clickContinue()
    fireEvent.click(screen.getByText('☕ قهوه'))
    fireEvent.click(screen.getByText('✈️ سفر'))
    fireEvent.click(screen.getByText('🎵 موسیقی'))
    clickContinue()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File([new ArrayBuffer(10)], 'o.png', { type: 'image/png' })] } })
    fireEvent.click(screen.getByTestId('editor-confirm'))
    fireEvent.click(await screen.findByRole('button', { name: 'ورود به لوما' }))
  }

  it('jumps back to the name step when the final save rejects the name', async () => {
    vi.mocked(api.photos.upload).mockResolvedValue({ id: 'p1', url: 'u', position: 0 } as never)
    vi.mocked(api.profile.update).mockRejectedValue(rejected('name', 'fake_name'))
    const onComplete = vi.fn()
    const { container } = render(<Onboarding onComplete={onComplete} />)
    await finishSignup(container)

    expect(await screen.findByText(FAKE_NAME_MSG)).toBeTruthy()
    expect(screen.getByPlaceholderText('تینا')).toHaveValue('Sara')
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('shows a bio rejection under the bio on the last step', async () => {
    vi.mocked(api.photos.upload).mockResolvedValue({ id: 'p1', url: 'u', position: 0 } as never)
    vi.mocked(api.profile.update).mockRejectedValue(rejected('bio', 'ad_or_spam'))
    const { container } = render(<Onboarding onComplete={vi.fn()} />)
    await finishSignup(container)

    expect(await screen.findByText('تبلیغات در بیو مجاز نیست. لطفاً ویرایشش کن.')).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('button', { name: 'ورود به لوما' })).toBeEnabled())
  })
})
