import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { PhotoGrid } from '../src/components/PhotoGrid.js'
import type { Photo } from '../src/components/PhotoGrid.js'

const PHOTOS: Photo[] = [
  { id: 'p1', url: 'https://example.com/p1.jpg', position: 0 },
  { id: 'p2', url: 'https://example.com/p2.jpg', position: 1 },
]

describe('PhotoGrid', () => {
  it('renders existing photos as images', () => {
    render(
      <PhotoGrid photos={PHOTOS} onUpload={vi.fn()} onDelete={vi.fn()} onReorder={vi.fn()} />
    )
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  it('shows add slot when below maxPhotos', () => {
    render(
      <PhotoGrid photos={PHOTOS} onUpload={vi.fn()} onDelete={vi.fn()} onReorder={vi.fn()} maxPhotos={6} />
    )
    expect(screen.getByText('+')).toBeInTheDocument()
  })

  it('hides add slot when at maxPhotos', () => {
    const sixPhotos = Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}`, url: `https://example.com/p${i}.jpg`, position: i,
    }))
    render(
      <PhotoGrid photos={sixPhotos} onUpload={vi.fn()} onDelete={vi.fn()} onReorder={vi.fn()} maxPhotos={6} />
    )
    expect(screen.queryByText('+')).not.toBeInTheDocument()
  })

  it('calls onDelete when ✕ button is clicked', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(
      <PhotoGrid photos={PHOTOS} onUpload={vi.fn()} onDelete={onDelete} onReorder={vi.fn()} />
    )
    fireEvent.click(screen.getAllByText('✕')[0])
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('p1'))
  })

  it('shows a spinner and disables the button on the photo being deleted', async () => {
    let resolveDelete: () => void
    const onDelete = vi.fn(() => new Promise<void>((resolve) => { resolveDelete = resolve }))
    render(
      <PhotoGrid photos={PHOTOS} onUpload={vi.fn()} onDelete={onDelete} onReorder={vi.fn()} />
    )
    const deleteButtons = screen.getAllByRole('button')
    fireEvent.click(deleteButtons[0])

    await waitFor(() => expect(deleteButtons[0]).toBeDisabled())
    expect(screen.getAllByText('✕')).toHaveLength(1) // only p2's button still shows ✕

    resolveDelete!()
    await waitFor(() => expect(deleteButtons[0]).not.toBeDisabled())
    expect(screen.getAllByText('✕')).toHaveLength(2)
  })

  it('shows error banner for non-image file type', async () => {
    const onUpload = vi.fn()
    render(
      <PhotoGrid photos={[]} onUpload={onUpload} onDelete={vi.fn()} onReorder={vi.fn()} />
    )
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const badFile = new File(['x'], 'doc.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [badFile] } })
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(onUpload).not.toHaveBeenCalled()
  })

  it('shows error banner for file over 20MB', async () => {
    const onUpload = vi.fn()
    render(
      <PhotoGrid photos={[]} onUpload={onUpload} onDelete={vi.fn()} onReorder={vi.fn()} />
    )
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const bigFile = new File([new ArrayBuffer(21 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [bigFile] } })
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(onUpload).not.toHaveBeenCalled()
  })

  it('swaps photos on tap-select then tap-place and calls onReorder', async () => {
    const onReorder = vi.fn().mockResolvedValue(undefined)
    render(
      <PhotoGrid photos={PHOTOS} onUpload={vi.fn()} onDelete={vi.fn()} onReorder={onReorder} />
    )
    const imgs = screen.getAllByRole('img')
    fireEvent.click(imgs[0])  // select p1
    fireEvent.click(imgs[1])  // place on p2 → swap → [p2, p1]
    await waitFor(() => expect(onReorder).toHaveBeenCalledWith(['p2', 'p1']))
  })

  it('deselects photo when tapped again', () => {
    const onReorder = vi.fn()
    render(
      <PhotoGrid photos={PHOTOS} onUpload={vi.fn()} onDelete={vi.fn()} onReorder={onReorder} />
    )
    const imgs = screen.getAllByRole('img')
    fireEvent.click(imgs[0])  // select
    fireEvent.click(imgs[0])  // deselect
    expect(onReorder).not.toHaveBeenCalled()
  })
})
