import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.unmock('../src/api.ts')
vi.unmock('../src/realtime.ts')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function setTelegram(initData: string, platform?: string) {
  ;(window as unknown as { Telegram?: unknown }).Telegram = { WebApp: { initData, platform } }
}

async function load() {
  vi.resetModules()
  return import('../src/session.js')
}

describe('clientHeaders', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    delete (window as unknown as { Telegram?: unknown }).Telegram
  })

  it('inside Telegram: telegram platform, auth, model = WebApp.platform', async () => {
    setTelegram('init=1', 'android')
    const { clientHeaders } = await load()
    const h = clientHeaders()
    expect(h['X-Client-Platform']).toBe('telegram')
    expect(h['X-Device-Model']).toBe('android')
    expect(h.Authorization).toBe('init=1')
    expect(h['X-Client-Version']).toBeTruthy()
    expect(h['X-Device-Id']).toMatch(UUID_RE)
  })

  it('outside Telegram: web platform and no model', async () => {
    const { clientHeaders } = await load()
    const h = clientHeaders()
    expect(h['X-Client-Platform']).toBe('web')
    expect(h['X-Device-Model']).toBeUndefined()
  })

  it('device id is stable and survives a fresh module import', async () => {
    const a = await load()
    const id = a.getDeviceId()
    expect(a.getDeviceId()).toBe(id)
    expect(localStorage.getItem('luma_device_id')).toBe(id)
    const b = await load()
    expect(b.clientHeaders()['X-Device-Id']).toBe(id)
  })

  it('falls back to a stable in-memory id when storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    const { getDeviceId } = await load()
    const id = getDeviceId()
    expect(id).toMatch(UUID_RE)
    expect(getDeviceId()).toBe(id)
  })

  it('api.request sends X-Device-Id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.resetModules()
    const { api } = await import('../src/api.js')
    const { getDeviceId } = await import('../src/session.js')
    await (api as unknown as { discovery: { feed: () => Promise<unknown> } }).discovery.feed().catch(() => {})
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers['X-Device-Id']).toBe(getDeviceId())
  })

  it('realtime fetch sends X-Device-Id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.resetModules()
    const { startRealtime, stopRealtime } = await import('../src/realtime.js')
    const { getDeviceId } = await import('../src/session.js')
    startRealtime()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    stopRealtime()
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers['X-Device-Id']).toBe(getDeviceId())
  })
})
