import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type * as Realtime from '../src/realtime.js'

// setup.ts stubs start/stop for screen tests — this file drives the real ones.
const rt = await vi.importActual<typeof Realtime>('../src/realtime.ts')

/** A fetch Response whose body we push chunks into. */
function streamingResponse(status = 200) {
  let ctrl!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start(c) { ctrl = c } })
  const enc = new TextEncoder()
  return {
    res: new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } }),
    push: (s: string) => ctrl.enqueue(enc.encode(s)),
    close: () => ctrl.close(),
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('toRealtimeEvent', () => {
  it('maps ready/resync to sync and parses message events', () => {
    expect(rt.toRealtimeEvent({ event: 'ready', data: '{}' })).toEqual({ type: 'sync' })
    expect(rt.toRealtimeEvent({ event: 'resync', data: '{}' })).toEqual({ type: 'sync' })
    expect(rt.toRealtimeEvent({ event: 'message', data: '{"matchId":"m","message":{"id":"x"}}' }))
      .toEqual({ type: 'message', matchId: 'm', message: { id: 'x' } })
    expect(rt.toRealtimeEvent({ event: 'message_deleted', data: '{"matchId":"m","messageId":"x"}' }))
      .toEqual({ type: 'message_deleted', matchId: 'm', messageId: 'x' })
    expect(rt.toRealtimeEvent({ event: 'message', data: 'not json' })).toBeNull()
    expect(rt.toRealtimeEvent({ event: 'whatever', data: '{"matchId":"m"}' })).toBeNull()
  })
})

describe('realtime connection', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    rt.stopRealtime()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('sends initData, dispatches events and tracks connected', async () => {
    const s = streamingResponse()
    fetchMock.mockResolvedValue(s.res)
    const seen: Realtime.RealtimeEvent[] = []
    const off = rt.subscribe((e) => seen.push(e))

    rt.startRealtime()
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/events$/)
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'mock_init_data' })

    s.push('retry: 3000\n\nevent: ready\ndata: {}\n\n: ping\n\nevent: message\ndata: {"matchId":"m1",')
    s.push('"message":{"id":"x","senderId":"u"}}\n\n')
    await flush(); await flush()
    expect(rt.useRealtimeStore.getState().connected).toBe(true)
    expect(seen).toEqual([{ type: 'sync' }, { type: 'message', matchId: 'm1', message: { id: 'x', senderId: 'u' } }])

    rt.stopRealtime()
    expect(rt.useRealtimeStore.getState().connected).toBe(false)
    off()
  })

  it('reconnects with backoff after the stream ends', async () => {
    vi.useFakeTimers()
    const first = streamingResponse()
    fetchMock.mockResolvedValueOnce(first.res).mockImplementation(() => Promise.resolve(streamingResponse().res))
    rt.startRealtime()
    await vi.advanceTimersByTimeAsync(0)
    first.close()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1_400) // 1 s + up to 30% jitter
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stops on 401 and does not retry until the app is foregrounded again', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(new Response('unauthorized', { status: 401 }))
    rt.startRealtime()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    document.dispatchEvent(new Event('visibilitychange')) // still visible in jsdom → counts as a return
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('watchdog aborts a silent stream and reconnects', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const s = streamingResponse()
      init.signal?.addEventListener('abort', () => s.close())
      return Promise.resolve(s.res)
    })
    rt.startRealtime()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60_000 + 1_400)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
