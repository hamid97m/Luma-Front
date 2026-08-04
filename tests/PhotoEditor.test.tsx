import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// jsdom has no Blob URL support (same gap cropImage.test.ts works around).
vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock'),
  revokeObjectURL: vi.fn(),
})

// Stub react-easy-crop: render a button that reports a fixed crop area,
// so the component's confirm path can run without real gesture/canvas work.
vi.mock('react-easy-crop', () => ({
  default: (props: any) => (
    <button
      data-testid="mock-crop-complete"
      onClick={() =>
        props.onCropComplete?.({ x: 0, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: 500, height: 500 })
      }
    >
      crop area: rot={props.rotation}
    </button>
  ),
}))

const EDITED = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
vi.mock('../src/utils/cropImage.js', () => ({
  cropImage: vi.fn(async () => EDITED),
}))

import { PhotoEditor } from '../src/components/PhotoEditor.js'
import { cropImage } from '../src/utils/cropImage.js'

function makeFile(): File {
  return new File([new ArrayBuffer(10)], 'orig.png', { type: 'image/png' })
}

describe('PhotoEditor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls onCancel when Cancel is pressed', () => {
    const onCancel = vi.fn()
    render(<PhotoEditor file={makeFile()} onCancel={onCancel} onConfirm={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('increments rotation by 90 when Rotate is pressed', () => {
    render(<PhotoEditor file={makeFile()} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByTestId('mock-crop-complete').textContent).toContain('rot=0')
    fireEvent.click(screen.getByRole('button', { name: /rotate/i }))
    expect(screen.getByTestId('mock-crop-complete').textContent).toContain('rot=90')
  })

  it('crops and calls onConfirm with the edited file on Use photo', async () => {
    const onConfirm = vi.fn()
    render(<PhotoEditor file={makeFile()} onCancel={vi.fn()} onConfirm={onConfirm} />)
    // Prime croppedAreaPixels via the stubbed cropper callback.
    fireEvent.click(screen.getByTestId('mock-crop-complete'))
    fireEvent.click(screen.getByRole('button', { name: /use photo/i }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(EDITED))
    expect(cropImage).toHaveBeenCalledWith(
      expect.any(File),
      { x: 0, y: 0, width: 500, height: 500 },
      0,
    )
  })

  it('shows an inline error and keeps the editor open when cropImage rejects', async () => {
    vi.mocked(cropImage).mockRejectedValueOnce(new Error('crop_failed'))
    const onConfirm = vi.fn()
    render(<PhotoEditor file={makeFile()} onCancel={vi.fn()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByTestId('mock-crop-complete'))
    fireEvent.click(screen.getByRole('button', { name: /use photo/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(onConfirm).not.toHaveBeenCalled()
    // Editor stays mounted and interactive — button reverts from "Saving…".
    expect(screen.getByRole('button', { name: /use photo/i })).not.toBeDisabled()
  })
})
