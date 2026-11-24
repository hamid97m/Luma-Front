import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { prepareEditorImage, PrepareImageError } from '../src/utils/prepareImage.js'

// jsdom can't decode images: a fake Image that "loads" with the given size or errors.
let nextImage: { w: number; h: number } | 'error' | 'hang' = { w: 100, h: 100 }
class FakeImage {
  naturalWidth = 0
  naturalHeight = 0
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(v: string) {
    if (!v) return
    const spec = nextImage
    if (spec === 'hang') return
    queueMicrotask(() => {
      if (spec === 'error') return this.onerror?.()
      this.naturalWidth = spec.w
      this.naturalHeight = spec.h
      this.onload?.()
    })
  }
}

let toBlobResult: Blob | null = new Blob(['jpeg'], { type: 'image/jpeg' })
const drawImage = vi.fn()
let canvasSize = { width: 0, height: 0 }

beforeEach(() => {
  nextImage = { w: 100, h: 100 }
  toBlobResult = new Blob(['jpeg'], { type: 'image/jpeg' })
  drawImage.mockClear()
  vi.stubGlobal('Image', FakeImage)
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
  const realCreate = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag !== 'canvas') return realCreate(tag)
    const canvas = {
      set width(v: number) { canvasSize.width = v },
      set height(v: number) { canvasSize.height = v },
      get width() { return canvasSize.width },
      get height() { return canvasSize.height },
      getContext: () => ({ drawImage }),
      toBlob: (cb: (b: Blob | null) => void) => cb(toBlobResult),
    }
    return canvas as unknown as HTMLCanvasElement
  }) as typeof document.createElement)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  canvasSize = { width: 0, height: 0 }
})

const file = () => new File(['x'], 'a.jpg', { type: 'image/jpeg' })

describe('prepareEditorImage', () => {
  it('returns the original file when it is already small enough', async () => {
    const f = file()
    nextImage = { w: 1200, h: 1600 }
    expect(await prepareEditorImage(f)).toBe(f)
    expect(drawImage).not.toHaveBeenCalled()
  })

  it('shrinks a large photo to 2048 on its long side, as a JPEG', async () => {
    nextImage = { w: 3000, h: 4000 }
    const out = await prepareEditorImage(file())
    expect(canvasSize).toEqual({ width: 1536, height: 2048 })
    expect(out.type).toBe('image/jpeg')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x')
  })

  it('rejects with "decode" when the browser cannot open the file', async () => {
    nextImage = 'error'
    await expect(prepareEditorImage(file())).rejects.toEqual(new PrepareImageError('decode'))
  })

  it('rejects with "decode" when the image never loads', async () => {
    vi.useFakeTimers()
    nextImage = 'hang'
    const p = prepareEditorImage(file())
    const check = expect(p).rejects.toEqual(new PrepareImageError('decode'))
    await vi.advanceTimersByTimeAsync(20_000)
    await check
  })

  it('rejects with "resize" when the canvas cannot produce a JPEG (out of memory)', async () => {
    nextImage = { w: 4000, h: 3000 }
    toBlobResult = null
    await expect(prepareEditorImage(file())).rejects.toEqual(new PrepareImageError('resize'))
  })
})
