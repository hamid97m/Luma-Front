import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../src/api.js'
import { track } from '../src/signupTrack.js'

const EDITED = new File(['e'], 'photo.jpg', { type: 'image/jpeg' })
vi.mock('../src/components/PhotoEditor.js', () => ({
  PhotoEditor: (props: { onConfirm: (file: File) => void }) => (
    <button data-testid="editor-confirm" onClick={() => props.onConfirm(EDITED)}>editor</button>
  ),
}))
vi.mock('../src/signupTrack.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/signupTrack.js')>()),
  track: vi.fn(),
}))

import { Onboarding } from '../src/screens/Onboarding.js'

const clickContinue = () => fireEvent.click(screen.getByRole('button', { name: 'ادامه' }))

function goToPhotoStep() {
  fireEvent.change(screen.getByPlaceholderText('تینا'), { target: { value: 'Ali' } })
  clickContinue()
  fireEvent.change(screen.getByPlaceholderText('تهران'), { target: { value: 'شیراز' } })
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
}

function pickAndConfirm(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File([new ArrayBuffer(10)], 'orig.png', { type: 'image/png' })] } })
  fireEvent.click(screen.getByTestId('editor-confirm'))
}

describe('Onboarding signup tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
  })

  it('reports a step_view for every step, in order', () => {
    render(<Onboarding onComplete={vi.fn()} />)
    goToPhotoStep()
    const steps = vi.mocked(track).mock.calls.filter(([n]) => n === 'step_view').map(([, o]) => o?.step)
    expect(steps).toEqual(['name', 'city', 'age', 'gender', 'pref', 'interests', 'photo'])
  })

  it('reports the pick and a failed upload by status, without the error text', async () => {
    vi.mocked(api.photos.upload).mockRejectedValue(Object.assign(new Error('Ali too big'), { status: 413 }))
    const { container } = render(<Onboarding onComplete={vi.fn()} />)
    goToPhotoStep()
    pickAndConfirm(container)
    await waitFor(() => expect(track).toHaveBeenCalledWith('photo_failed', { step: 'photo', detail: 'file:413' }))
    expect(track).toHaveBeenCalledWith('photo_pick', { step: 'photo' })
  })

  it('reports a successful upload, then a failed submit by status', async () => {
    vi.mocked(api.photos.upload).mockResolvedValue({ id: 'p1', url: 'u', position: 0 } as never)
    vi.mocked(api.profile.update).mockRejectedValue(Object.assign(new Error('invalid_age'), { status: 400 }))
    const { container } = render(<Onboarding onComplete={vi.fn()} />)
    goToPhotoStep()
    pickAndConfirm(container)
    fireEvent.click(await screen.findByRole('button', { name: 'ورود به لوما' }))
    await waitFor(() => expect(track).toHaveBeenCalledWith('submit_failed', { step: 'photo', detail: '400' }))
    expect(track).toHaveBeenCalledWith('photo_ok', { step: 'photo', detail: 'file' })
  })
})
