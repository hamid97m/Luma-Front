import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../src/api.js'

const EDITED = new File(['e'], 'photo.jpg', { type: 'image/jpeg' })
vi.mock('../src/components/PhotoEditor.js', () => ({
  PhotoEditor: (props: any) => (
    <button data-testid="editor-confirm" onClick={() => props.onConfirm(EDITED)}>editor</button>
  ),
}))

import { Onboarding } from '../src/screens/Onboarding.js'

describe('Onboarding photo editor wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.photos.upload).mockResolvedValue({ id: 'p1', url: 'u', position: 0 } as any)
    // jsdom doesn't implement createObjectURL; Onboarding's handlePhotoFile
    // calls it synchronously before uploading, so stub it for this test.
    URL.createObjectURL = vi.fn(() => 'blob:mock')
  })

  it('opens the editor on file select and uploads the edited file on confirm', async () => {
    const { container } = render(<Onboarding onComplete={vi.fn()} />)

    const clickContinue = () => {
      const btn = screen.getByRole('button', { name: /ادامه|ورود به لوما/ })
      fireEvent.click(btn)
    }

    // Step 0: name (required, min 2 chars).
    fireEvent.change(screen.getByPlaceholderText('تینا'), { target: { value: 'Ali' } })
    clickContinue()

    // Step 1: city (required).
    fireEvent.change(screen.getByPlaceholderText('تهران'), { target: { value: 'شیراز' } })
    clickContinue()

    // Step 2: age (required, 18-99).
    fireEvent.change(screen.getByPlaceholderText('25'), { target: { value: '25' } })
    clickContinue()

    // Step 3: gender (required).
    fireEvent.click(screen.getByText('زن'))
    clickContinue()

    // Step 4: looking-for preference (required).
    fireEvent.click(screen.getByText('همه'))
    clickContinue()

    // Step 5: interests (required, at least 3).
    fireEvent.click(screen.getByText('☕ قهوه'))
    fireEvent.click(screen.getByText('✈️ سفر'))
    fireEvent.click(screen.getByText('🎵 موسیقی'))
    clickContinue()

    // Step 6: photo & bio — the file input should now be present.
    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null
    expect(input).not.toBeNull()

    const picked = new File([new ArrayBuffer(10)], 'orig.png', { type: 'image/png' })
    fireEvent.change(input!, { target: { files: [picked] } })
    fireEvent.click(await screen.findByTestId('editor-confirm'))

    await waitFor(() =>
      expect(api.photos.upload).toHaveBeenCalledWith(EDITED, expect.any(Function)),
    )
  })
})
