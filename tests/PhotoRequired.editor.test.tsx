import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../src/api.js'

const EDITED = new File(['e'], 'photo.jpg', { type: 'image/jpeg' })
vi.mock('../src/components/PhotoEditor.js', () => ({
  PhotoEditor: (props: { onConfirm: (file: File) => void }) => (
    <button data-testid="editor-confirm" onClick={() => props.onConfirm(EDITED)}>editor</button>
  ),
}))

import { PhotoRequired } from '../src/screens/PhotoRequired.js'

describe('PhotoRequired photo editor wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.photos.upload).mockResolvedValue({ id: 'p1', url: 'u', position: 0 } as never)
  })

  it('opens the editor on file select and uploads the edited file on confirm', async () => {
    const { container } = render(<PhotoRequired />)

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const picked = new File([new ArrayBuffer(10)], 'orig.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [picked] } })

    expect(api.photos.upload).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByTestId('editor-confirm'))

    await waitFor(() =>
      expect(api.photos.upload).toHaveBeenCalledWith(EDITED),
    )
  })
})
