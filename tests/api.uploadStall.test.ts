import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../src/utils/compress.js', () => ({
  compressImage: vi.fn(async () => new Blob(['jpeg'], { type: 'image/jpeg' })),
}))

// setup.ts mocks api globally; this file tests the real one.
vi.unmock('../src/api.ts')
import { api, UPLOAD_STALL_MS } from '../src/api.js'
import { compressImage } from '../src/utils/compress.js'

// A PUT that never answers until the test says so.
class FakeXhr {
  static last: FakeXhr
  status = 0
  aborted = false
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() { FakeXhr.last = this }
  open() {}
  setRequestHeader() {}
  send() {}
  abort() { this.aborted = true }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(JSON.stringify({ uploadUrl: 'https://up', photoId: 'p1' }), { status: 200 })))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const file = () => new File(['x'], 'a.jpg', { type: 'image/jpeg' })

describe('photo upload stall', () => {
  it('aborts and rejects with code "timeout" when no progress arrives', async () => {
    const p = api.photos.upload(file())
    const check = expect(p).rejects.toMatchObject({ code: 'timeout' })
    await vi.advanceTimersByTimeAsync(UPLOAD_STALL_MS)
    await check
    expect(FakeXhr.last.aborted).toBe(true)
  })

  it('keeps waiting while bytes are still moving', async () => {
    const p = api.photos.upload(file())
    p.catch(() => {})
    await vi.advanceTimersByTimeAsync(UPLOAD_STALL_MS - 1000)
    FakeXhr.last.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 })
    await vi.advanceTimersByTimeAsync(UPLOAD_STALL_MS - 1000)
    expect(FakeXhr.last.aborted).toBe(false)
  })

  it('reports a compression failure as code "compress", not a network error', async () => {
    vi.mocked(compressImage).mockRejectedValueOnce(new Error('boom'))
    await expect(api.photos.upload(file())).rejects.toMatchObject({ code: 'compress' })
  })
})
