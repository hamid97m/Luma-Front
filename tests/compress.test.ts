// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockBitmap = { width: 2400, height: 1800, close: vi.fn() }
vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(mockBitmap))

const FAKE_BLOB = new Blob(['fake'], { type: 'image/jpeg' })
HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => cb(FAKE_BLOB)) as any
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  drawImage: vi.fn(),
  transform: vi.fn(),
})) as any

import { compressImage } from '../src/utils/compress.js'

function makeFile(type = 'image/jpeg'): File {
  return new File([new ArrayBuffer(100)], 'photo.jpg', { type })
}

describe('compressImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => cb(FAKE_BLOB)) as any
  })

  it('returns a Blob', async () => {
    const result = await compressImage(makeFile())
    expect(result).toBeInstanceOf(Blob)
  })

  it('calls toBlob with image/jpeg and quality 0.85', async () => {
    await compressImage(makeFile())
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function), 'image/jpeg', 0.85
    )
  })

  it('does not upscale images already smaller than 1200px', async () => {
    vi.mocked(createImageBitmap).mockResolvedValueOnce(
      { ...mockBitmap, width: 800, height: 600 }
    )
    const result = await compressImage(makeFile())
    expect(result).toBeInstanceOf(Blob)
  })

  it('rejects with compression_failed when toBlob returns null', async () => {
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => cb(null)) as any
    await expect(compressImage(makeFile())).rejects.toThrow('compression_failed')
  })
})
