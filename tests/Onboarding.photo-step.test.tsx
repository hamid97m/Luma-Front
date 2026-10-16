import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../src/api.js'

const EDITED = new File(['e'], 'photo.jpg', { type: 'image/jpeg' })
vi.mock('../src/components/PhotoEditor.js', () => ({
  PhotoEditor: (props: { onConfirm: (file: File) => void }) => (
    <button data-testid="editor-confirm" onClick={() => props.onConfirm(EDITED)}>editor</button>
  ),
}))

import { Onboarding } from '../src/screens/Onboarding.js'

function goToPhotoStep() {
  const clickContinue = () => {
    const btn = screen.queryByRole('button', { name: 'ادامه' })
    if (btn) {
      fireEvent.click(btn)
      return
    }
    const mb = window.Telegram?.WebApp?.MainButton as { onClick?: { mock: { calls: Array<[() => void]> } } } | undefined
    const calls = mb?.onClick?.mock?.calls
    const handler = calls?.[calls.length - 1]?.[0]
    if (!handler) throw new Error('no continue control')
    act(() => { handler() })
  }
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

function pickPhoto(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  const picked = new File([new ArrayBuffer(10)], 'orig.png', { type: 'image/png' })
  fireEvent.change(input, { target: { files: [picked] } })
}

describe('Onboarding photo step', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
  })

  it('hides Enter Luma while the photo is being chosen', () => {
    const { container } = render(<Onboarding onComplete={vi.fn()} />)
    goToPhotoStep()

    expect(screen.queryByRole('button', { name: 'ورود به لوما' })).toBeNull()

    pickPhoto(container)
    expect(screen.getByTestId('editor-confirm')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'ورود به لوما' })).toBeNull()
  })

  it('keeps Enter Luma inactive during upload and shows a moving progress bar instead of a stuck 100', async () => {
    let release: (photo: { id: string; url: string; position: number }) => void = () => {}
    vi.mocked(api.photos.upload).mockImplementation((_file, onProgress) => {
      onProgress?.(100)
      return new Promise((resolve) => { release = resolve })
    })

    const { container } = render(<Onboarding onComplete={vi.fn()} />)
    goToPhotoStep()
    pickPhoto(container)
    fireEvent.click(screen.getByTestId('editor-confirm'))

    expect(await screen.findByRole('progressbar')).toBeTruthy()
    expect(screen.queryByText('100%')).toBeNull()
    expect(screen.queryByRole('button', { name: 'ورود به لوما' })).toBeNull()

    await act(async () => { release({ id: 'p1', url: 'u', position: 0 }) })
    const enter = await screen.findByRole('button', { name: 'ورود به لوما' })
    expect(enter).toBeEnabled()
  })

  it('hides the native Telegram button on the photo step and uses the in-app button once the photo is saved', async () => {
    const mb = {
      setText: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn(),
      setParams: vi.fn(),
    }
    Object.assign(window.Telegram!.WebApp!, { MainButton: mb })
    vi.mocked(api.photos.upload).mockResolvedValue({ id: 'p1', url: 'u', position: 0 } as never)

    const { container } = render(<Onboarding onComplete={vi.fn()} />)
    goToPhotoStep()

    expect(mb.hide).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'ورود به لوما' })).toBeNull()

    pickPhoto(container)
    fireEvent.click(screen.getByTestId('editor-confirm'))

    const enter = await screen.findByRole('button', { name: 'ورود به لوما' })
    expect(enter.className).toContain('bg-primary')
    expect(enter.className).not.toContain('grad-tg')
  })
})
