import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom'
import { ProfileSetup } from '../src/screens/ProfileSetup.js'
import { api } from '../src/api.js'

vi.mock('../src/api.js', () => ({
  api: {
    auth: { verify: vi.fn() },
    profile: { get: vi.fn(), update: vi.fn() },
    photos: {
      getUploadUrl: vi.fn(),
      confirm: vi.fn(),
      delete: vi.fn(),
      reorder: vi.fn(),
      upload: vi.fn(),
    },
    discovery: { feed: vi.fn() },
    swipes: { swipe: vi.fn() },
    matches: { list: vi.fn() },
  },
}))

vi.mock('../src/components/PhotoGrid.js', () => ({
  PhotoGrid: ({ onUpload, photos }: { onUpload: (f: File) => Promise<void>; photos: unknown[] }) => (
    <div data-testid="photo-grid">
      <span data-testid="photo-count">{photos.length}</span>
      <button onClick={() => onUpload(new File(['x'], 'p.jpg', { type: 'image/jpeg' }))}>
        upload-photo
      </button>
    </div>
  ),
}))

describe('ProfileSetup', () => {
  it('shows age step first', () => {
    render(<ProfileSetup onComplete={vi.fn()} />)
    expect(screen.getByText(/چند سالته/i)).toBeInTheDocument()
  })

  it('Next button is disabled on photos step until a photo is uploaded', async () => {
    vi.mocked(api.photos.upload).mockResolvedValue({ id: 'p1', url: 'https://x.com/p1.jpg', position: 0 })

    render(<ProfileSetup onComplete={vi.fn()} />)

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '25' } })
    fireEvent.click(screen.getByText(/بعدی/))
    fireEvent.click(screen.getByText(/مرد/))
    fireEvent.click(screen.getByText(/بعدی/))
    fireEvent.click(screen.getByText(/خانم/))
    fireEvent.click(screen.getByText(/بعدی/))

    const nextBtn = screen.getByText(/بعدی/)
    expect(nextBtn).toBeDisabled()

    fireEvent.click(screen.getByText('upload-photo'))
    await waitFor(() => expect(nextBtn).not.toBeDisabled())
  })

  it('calls api.profile.update with correct data on final step', async () => {
    vi.mocked(api.photos.upload).mockResolvedValue({ id: 'p1', url: 'https://x.com/p1.jpg', position: 0 })
    vi.mocked(api.profile.update).mockResolvedValue({} as any)
    const onComplete = vi.fn()

    render(<ProfileSetup onComplete={onComplete} />)

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '25' } })
    fireEvent.click(screen.getByText(/بعدی/))
    fireEvent.click(screen.getByText(/مرد/))
    fireEvent.click(screen.getByText(/بعدی/))
    fireEvent.click(screen.getByText(/خانم/))
    fireEvent.click(screen.getByText(/بعدی/))

    fireEvent.click(screen.getByText('upload-photo'))
    await waitFor(() => expect(screen.getByText(/بعدی/)).not.toBeDisabled())
    fireEvent.click(screen.getByText(/بعدی/))

    fireEvent.click(screen.getByText(/بریم/))

    await waitFor(() => {
      expect(api.profile.update).toHaveBeenCalledWith(
        expect.objectContaining({ age: 25, gender: 'man', looking_for: 'women' })
      )
    })
  })
})
