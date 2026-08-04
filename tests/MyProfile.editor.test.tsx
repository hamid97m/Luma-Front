import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../src/api.js'

// Stub the editor: immediately confirm with a sentinel edited file.
const EDITED = new File(['e'], 'photo.jpg', { type: 'image/jpeg' })
vi.mock('../src/components/PhotoEditor.js', () => ({
  PhotoEditor: (props: any) => (
    <button data-testid="editor-confirm" onClick={() => props.onConfirm(EDITED)}>editor</button>
  ),
}))

const PROFILE = {
  id: 'u1', name: 'Ali', age: 25, bio: '', location: '', gender: 'male',
  interested_in: 'female', interests: [], prompt: '', answer: '',
  is_active: true, photos: [], setupComplete: true,
}

import { MyProfile } from '../src/screens/MyProfile.js'

describe('MyProfile photo editor wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.profile.get).mockResolvedValue(PROFILE as any)
    vi.mocked(api.photos.upload).mockResolvedValue({ id: 'p1', url: 'u', position: 0 } as any)
  })

  it('opens the editor on file select and uploads the edited file on confirm', async () => {
    const { container } = render(<MyProfile onOpenSupport={vi.fn()} />)
    await waitFor(() => screen.getByText('My Profile 👤'))

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const picked = new File([new ArrayBuffer(10)], 'orig.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [picked] } })

    // Editor appears, confirm it.
    fireEvent.click(await screen.findByTestId('editor-confirm'))

    await waitFor(() =>
      expect(api.photos.upload).toHaveBeenCalledWith(EDITED, expect.any(Function)),
    )
  })
})
