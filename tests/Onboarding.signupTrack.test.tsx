import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../src/api.js'
import { track } from '../src/signupTrack.js'
import { t } from '../src/i18n.js'

const EDITED = new File(['e'], 'photo.jpg', { type: 'image/jpeg' })
vi.mock('../src/components/PhotoEditor.js', () => ({
  PhotoEditor: (props: { onConfirm: (file: File) => void; onCancel: () => void; onError?: (r: string) => void }) => (
    <>
      <button data-testid="editor-confirm" onClick={() => props.onConfirm(EDITED)}>editor</button>
      <button data-testid="editor-cancel" onClick={props.onCancel}>cancel</button>
      <button data-testid="editor-decode-fail" onClick={() => props.onError?.('decode')}>fail</button>
    </>
  ),
}))
vi.mock('../src/signupTrack.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/signupTrack.js')>()),
  track: vi.fn(),
}))

import { Onboarding } from '../src/screens/Onboarding.js'

const clickContinue = () => fireEvent.click(screen.getByRole('button', { name: 'ادامه' }))

async function goToPhotoStep() {
  fireEvent.change(screen.getByPlaceholderText('تینا'), { target: { value: 'Ali' } })
  clickContinue()
  await screen.findByPlaceholderText('تهران') // name step waits for the server name check
  fireEvent.change(screen.getByPlaceholderText('تهران'), { target: { value: 'شیراز' } })
  clickContinue()
  fireEvent.change(screen.getByPlaceholderText('25'), { target: { value: '25' } })
  clickContinue()
  fireEvent.click(screen.getByText('زن'))
  clickContinue()
  fireEvent.click(screen.getByRole('button', { name: 'بله، درسته' })) // gender lock confirmation
  fireEvent.click(screen.getByText('همه'))
  clickContinue()
  fireEvent.click(screen.getByText('☕ قهوه'))
  fireEvent.click(screen.getByText('✈️ سفر'))
  fireEvent.click(screen.getByText('🎵 موسیقی'))
  clickContinue()
}

function pick(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File([new ArrayBuffer(10)], 'orig.png', { type: 'image/png' })] } })
}

function pickAndConfirm(container: HTMLElement) {
  pick(container)
  fireEvent.click(screen.getByTestId('editor-confirm'))
}

describe('Onboarding signup tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
  })

  it('reports a step_view for every step, in order', async () => {
    render(<Onboarding onComplete={vi.fn()} />)
    await goToPhotoStep()
    const steps = vi.mocked(track).mock.calls.filter(([n]) => n === 'step_view').map(([, o]) => o?.step)
    expect(steps).toEqual(['name', 'city', 'age', 'gender', 'pref', 'interests', 'photo'])
  })

  it('reports the pick and a failed upload by status, without the error text', async () => {
    vi.mocked(api.photos.upload).mockRejectedValue(Object.assign(new Error('Ali too big'), { status: 413 }))
    const { container } = render(<Onboarding onComplete={vi.fn()} />)
    await goToPhotoStep()
    pickAndConfirm(container)
    await waitFor(() => expect(track).toHaveBeenCalledWith('photo_failed', { step: 'photo', detail: 'file:413' }))
    expect(track).toHaveBeenCalledWith('photo_pick', { step: 'photo' })
  })

  it('reports a successful upload, then a failed submit by status', async () => {
    vi.mocked(api.photos.upload).mockResolvedValue({ id: 'p1', url: 'u', position: 0 } as never)
    vi.mocked(api.profile.update).mockRejectedValue(Object.assign(new Error('invalid_age'), { status: 400 }))
    const { container } = render(<Onboarding onComplete={vi.fn()} />)
    await goToPhotoStep()
    pickAndConfirm(container)
    fireEvent.click(await screen.findByRole('button', { name: 'ورود به لوما' }))
    await waitFor(() => expect(track).toHaveBeenCalledWith('submit_failed', { step: 'photo', detail: '400' }))
    expect(track).toHaveBeenCalledWith('photo_ok', { step: 'photo', detail: 'file' })
  })

  it('reports leaving the crop screen and an unreadable photo', async () => {
    const { container } = render(<Onboarding onComplete={vi.fn()} />)
    await goToPhotoStep()
    pick(container)
    fireEvent.click(screen.getByTestId('editor-decode-fail'))
    expect(track).toHaveBeenCalledWith('photo_failed', { step: 'photo', detail: 'editor:decode' })
    fireEvent.click(screen.getByTestId('editor-cancel'))
    expect(track).toHaveBeenCalledWith('photo_failed', { step: 'photo', detail: 'editor:cancel' })
    expect(screen.queryByTestId('editor-confirm')).not.toBeInTheDocument()
  })

  it('retries once, quietly, when the upload stalls — and reports the stall', async () => {
    const showAlert = vi.fn()
    Object.assign(window.Telegram!.WebApp!, { showAlert })
    vi.mocked(api.photos.upload)
      .mockRejectedValueOnce(Object.assign(new Error('upload_timeout'), { code: 'timeout' }))
      .mockResolvedValueOnce({ id: 'p1', url: 'u', position: 0 } as never)
    const { container } = render(<Onboarding onComplete={vi.fn()} />)
    await goToPhotoStep()
    pickAndConfirm(container)
    await waitFor(() => expect(track).toHaveBeenCalledWith('photo_ok', { step: 'photo', detail: 'file' }))
    expect(api.photos.upload).toHaveBeenCalledTimes(2)
    expect(track).toHaveBeenCalledWith('photo_failed', { step: 'photo', detail: 'file:timeout' })
    expect(showAlert).not.toHaveBeenCalled()
  })

  it('does not retry a server rejection, and shows a readable message instead of the raw error', async () => {
    const showAlert = vi.fn()
    Object.assign(window.Telegram!.WebApp!, { showAlert })
    vi.mocked(api.photos.upload).mockRejectedValue(
      Object.assign(new Error('{"error":"photo_confirm_failed"}'), { status: 500 }))
    const { container } = render(<Onboarding onComplete={vi.fn()} />)
    await goToPhotoStep()
    pickAndConfirm(container)
    await waitFor(() => expect(showAlert).toHaveBeenCalledWith(t.photoGrid.uploadFailed))
    expect(api.photos.upload).toHaveBeenCalledTimes(1)
  })

  it('gives up after the retry also fails', async () => {
    const showAlert = vi.fn()
    Object.assign(window.Telegram!.WebApp!, { showAlert })
    vi.mocked(api.photos.upload).mockRejectedValue(new Error('storage_put_failed'))
    const { container } = render(<Onboarding onComplete={vi.fn()} />)
    await goToPhotoStep()
    pickAndConfirm(container)
    await waitFor(() => expect(showAlert).toHaveBeenCalledWith(t.photoGrid.uploadFailed))
    expect(api.photos.upload).toHaveBeenCalledTimes(2)
  })
})
