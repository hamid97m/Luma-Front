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

// jsdom can't decode images; the real prepareEditorImage is covered by its own test.
const PREPARED = new File(['p'], 'prepared.jpg', { type: 'image/jpeg' })
vi.mock('../src/utils/prepareImage.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/utils/prepareImage.js')>()),
  prepareEditorImage: vi.fn(async () => PREPARED),
}))

import { PhotoEditor } from '../src/components/PhotoEditor.js'
import { cropImage } from '../src/utils/cropImage.js'
import { prepareEditorImage, PrepareImageError } from '../src/utils/prepareImage.js'
import { t } from '../src/i18n.js'

function makeFile(): File {
  return new File([new ArrayBuffer(10)], 'orig.png', { type: 'image/png' })
}

const cropper = () => screen.findByTestId('mock-crop-complete')
const useButton = () => screen.getByRole('button', { name: t.photoEditor.use })

describe('PhotoEditor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls onCancel when Cancel is pressed', async () => {
    const onCancel = vi.fn()
    render(<PhotoEditor file={makeFile()} onCancel={onCancel} onConfirm={vi.fn()} />)
    await cropper()
    fireEvent.click(screen.getByRole('button', { name: t.photoEditor.cancel }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('increments rotation by 90 when Rotate is pressed', async () => {
    render(<PhotoEditor file={makeFile()} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect((await cropper()).textContent).toContain('rot=0')
    fireEvent.click(screen.getByRole('button', { name: t.photoEditor.rotateAria }))
    expect(screen.getByTestId('mock-crop-complete').textContent).toContain('rot=90')
  })

  it('crops the prepared (shrunk) file and calls onConfirm with the result', async () => {
    const onConfirm = vi.fn()
    render(<PhotoEditor file={makeFile()} onCancel={vi.fn()} onConfirm={onConfirm} />)
    fireEvent.click(await cropper())
    fireEvent.click(useButton())
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(EDITED))
    expect(cropImage).toHaveBeenCalledWith(PREPARED, { x: 0, y: 0, width: 500, height: 500 }, 0)
  })

  it('keeps "Use photo" disabled until the crop area is known (it used to silently do nothing)', async () => {
    render(<PhotoEditor file={makeFile()} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    await cropper()
    expect(useButton()).toBeDisabled()
    fireEvent.click(screen.getByTestId('mock-crop-complete'))
    expect(useButton()).not.toBeDisabled()
  })

  it('shows a preparing message until the photo is ready', async () => {
    let resolve!: (f: File) => void
    vi.mocked(prepareEditorImage).mockReturnValueOnce(new Promise((r) => { resolve = r }))
    render(<PhotoEditor file={makeFile()} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByText(t.photoEditor.preparing)).toBeInTheDocument()
    expect(screen.queryByTestId('mock-crop-complete')).not.toBeInTheDocument()
    resolve(PREPARED)
    await cropper()
  })

  it('explains an unreadable photo, reports it, and offers to pick another', async () => {
    vi.mocked(prepareEditorImage).mockRejectedValueOnce(new PrepareImageError('decode'))
    const onCancel = vi.fn()
    const onError = vi.fn()
    render(<PhotoEditor file={makeFile()} onCancel={onCancel} onConfirm={vi.fn()} onError={onError} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(t.photoEditor.loadFailed)
    expect(onError).toHaveBeenCalledWith('decode')
    expect(screen.queryByRole('button', { name: t.photoEditor.use })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: t.photoEditor.pickAnother }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('reports a resize failure with its own reason', async () => {
    vi.mocked(prepareEditorImage).mockRejectedValueOnce(new PrepareImageError('resize'))
    const onError = vi.fn()
    render(<PhotoEditor file={makeFile()} onCancel={vi.fn()} onConfirm={vi.fn()} onError={onError} />)
    await screen.findByRole('alert')
    expect(onError).toHaveBeenCalledWith('resize')
  })

  it('shows an inline error, reports "crop", and stays open when cropImage rejects', async () => {
    vi.mocked(cropImage).mockRejectedValueOnce(new Error('crop_failed'))
    const onConfirm = vi.fn()
    const onError = vi.fn()
    render(<PhotoEditor file={makeFile()} onCancel={vi.fn()} onConfirm={onConfirm} onError={onError} />)
    fireEvent.click(await cropper())
    fireEvent.click(useButton())

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('crop')
    // Editor stays mounted and interactive — button reverts from "Saving…".
    expect(useButton()).not.toBeDisabled()
  })
})
