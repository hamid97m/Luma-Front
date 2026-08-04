// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// jsdom has no canvas / image decoding — mock them like compress.test.ts does.
class MockImage {
  onload: (() => void) | null = null
  width = 1000
  height = 1000
  set src(_v: string) {
    // Fire load asynchronously so `await` in cropImage resolves.
    Promise.resolve().then(() => this.onload?.())
  }
}
vi.stubGlobal('Image', MockImage as unknown as typeof Image)
vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock'),
  revokeObjectURL: vi.fn(),
})

const FAKE_BLOB = new Blob(['fake'], { type: 'image/jpeg' })
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  translate: vi.fn(),
  rotate: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
  putImageData: vi.fn(),
})) as any
HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) => cb(FAKE_BLOB)) as any

import { cropImage } from '../src/utils/cropImage.js'

function makeFile(): File {
  return new File([new ArrayBuffer(100)], 'orig.png', { type: 'image/png' })
}

describe('cropImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) => cb(FAKE_BLOB)) as any
  })

  it('returns a JPEG File named photo.jpg', async () => {
    const result = await cropImage(makeFile(), { x: 0, y: 0, width: 500, height: 500 }, 0)
    expect(result).toBeInstanceOf(File)
    expect(result.type).toBe('image/jpeg')
    expect(result.name).toBe('photo.jpg')
  })

  it('exports the canvas as image/jpeg', async () => {
    await cropImage(makeFile(), { x: 10, y: 10, width: 400, height: 400 }, 90)
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function), 'image/jpeg', expect.any(Number)
    )
  })

  it('rejects with crop_failed when toBlob returns null', async () => {
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) => cb(null)) as any
    await expect(
      cropImage(makeFile(), { x: 0, y: 0, width: 500, height: 500 }, 0)
    ).rejects.toThrow('crop_failed')
  })
})
