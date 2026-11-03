import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type Tracker = typeof import('../src/signupTrack.js')

const fetchMock = vi.fn()
const pageListeners: { target: EventTarget; type: string; fn: EventListener }[] = []

// Module state is per launch, so every test gets a fresh module.
async function launch(): Promise<Tracker> {
  vi.resetModules()
  return import('../src/signupTrack.js')
}

function bodies(): { sessionId: string; platform: string; locale: string; events: { name: string; step?: string; detail?: string }[] }[] {
  return fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string))
}
const sent = () => bodies().flatMap((b) => b.events)
const sentNames = () => sent().map((e) => e.name)

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('signupTrack', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.removeItem('luma_setup_complete_tg_id')
    localStorage.removeItem('luma_signup_done')
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    // Each "launch" adds page listeners: record them so the next test starts clean.
    for (const target of [document, window]) {
      const add = target.addEventListener.bind(target) as EventTarget['addEventListener']
      vi.spyOn(target, 'addEventListener').mockImplementation(((type: string, fn: EventListener) => {
        pageListeners.push({ target, type, fn })
        add(type, fn)
      }) as never)
    }
  })

  afterEach(() => {
    setVisibility('visible')
    for (const { target, type, fn } of pageListeners.splice(0)) target.removeEventListener(type, fn)
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('sends nothing at all for a finished profile, including app_open', async () => {
    const s = await launch()
    s.trackAppOpen()
    s.trackAuthResolved(true)
    s.track('step_view', { step: 'name' })
    s.track('photo_pick', { step: 'photo' })
    setVisibility('hidden')
    await vi.runAllTimersAsync()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('holds app_open until auth resolves, then sends it for a new user', async () => {
    const s = await launch()
    s.trackAppOpen()
    await vi.runAllTimersAsync()
    expect(fetchMock).not.toHaveBeenCalled()

    s.trackAuthResolved(false)
    expect(sentNames()).toEqual(['app_open', 'auth_ok'])
    const [body] = bodies()
    expect(body.platform).toBe('telegram')
    expect(body.locale).toBe('fa')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', keepalive: true })
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('mock_init_data')
  })

  it('sends app_open on auth failure, with a status or network detail', async () => {
    const s = await launch()
    s.trackAppOpen()
    s.trackAuthFailed(Object.assign(new Error('secret body'), { status: 503 }))
    s.trackAuthFailed(new TypeError('Failed to fetch'))
    await vi.runAllTimersAsync()
    expect(sent()).toEqual([
      { name: 'app_open' },
      { name: 'auth_failed', detail: '503' },
      { name: 'auth_failed', detail: 'network' },
    ])
  })

  it('treats an auth failure on a known-returning device as no signup at all', async () => {
    localStorage.setItem('luma_setup_complete_tg_id', '123')
    const s = await launch()
    s.trackAppOpen()
    s.trackAuthFailed(new TypeError('Failed to fetch'))
    await vi.runAllTimersAsync()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stopping while auth is unresolved (banned) drops the buffered events', async () => {
    const s = await launch()
    s.trackAppOpen()
    s.stopSignupTracking()
    s.trackAuthResolved(false)
    await vi.runAllTimersAsync()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the session id stable across calls and uses it on every post', async () => {
    const s = await launch()
    const id = s.getSignupSessionId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(s.getSignupSessionId()).toBe(id)
    s.trackAuthResolved(false)
    s.track('photo_pick', { step: 'photo' })
    await vi.runAllTimersAsync()
    expect(bodies().map((b) => b.sessionId)).toEqual([id, id])
  })

  it('falls back to a valid v4 uuid without crypto.randomUUID', async () => {
    vi.stubGlobal('crypto', { getRandomValues: (b: Uint8Array) => b.fill(255) })
    const s = await launch()
    expect(s.getSignupSessionId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    vi.stubGlobal('crypto', undefined)
    const t = await launch()
    expect(t.getSignupSessionId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('swallows a rejected and a throwing fetch', async () => {
    const s = await launch()
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    expect(() => s.trackAuthResolved(false)).not.toThrow()
    await vi.runAllTimersAsync()
    fetchMock.mockImplementation(() => { throw new Error('boom') })
    s.track('photo_pick', { step: 'photo' })
    await expect(vi.runAllTimersAsync()).resolves.toBeDefined()
  })

  it('never lets non-matching text into detail', async () => {
    const s = await launch()
    s.trackAuthResolved(false)
    const bad = ['Ali Rezaei', 'رضا', 'UPPER', 'has space', '{"error":"x"}', 'a'.repeat(33), '']
    for (const detail of bad) s.track('submit_failed', { step: 'photo', detail })
    s.track('submit_failed', { step: 'photo', detail: 'file:401' })
    await vi.runAllTimersAsync()
    const details = sent().filter((e) => e.name === 'submit_failed').map((e) => e.detail)
    expect(details).toEqual([...bad.map(() => undefined), 'file:401'])
  })

  it('error details carry only the status, never the message', async () => {
    const s = await launch()
    expect(s.signupErrorDetail(Object.assign(new Error('Ali said no'), { status: 409 }), 'telegram')).toBe('telegram:409')
    expect(s.signupErrorDetail(new Error('Ali said no'), 'file')).toBe('file:network')
    expect(s.signupErrorDetail(Object.assign(new Error('x'), { status: '500' }))).toBe('network')
    expect(s.signupErrorDetail(null)).toBe('network')
  })

  it('dedupes launch events and repeated step_view, as a remount or StrictMode would', async () => {
    const s = await launch()
    s.trackAuthResolved(false)
    s.trackAppOpen()
    s.trackAuthResolved(false)
    s.track('step_view', { step: 'name' })
    s.track('step_view', { step: 'name' })
    s.track('step_view', { step: 'city' })
    s.track('step_view', { step: 'name' })
    await vi.runAllTimersAsync()
    expect(sent().filter((e) => e.name === 'auth_ok')).toHaveLength(1)
    expect(sent().filter((e) => e.name === 'step_view').map((e) => e.step)).toEqual(['name', 'city', 'name'])
  })

  it('batches on a short timer and caps each post at 20 events', async () => {
    const s = await launch()
    s.trackAuthResolved(false)
    fetchMock.mockClear()
    for (let i = 0; i < 45; i++) s.track('photo_pick', { step: 'photo' })
    expect(fetchMock).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    expect(bodies().map((b) => b.events.length)).toEqual([20, 20, 5])
  })

  it('page_hidden sends the buffer immediately with the current step, once per hide', async () => {
    const s = await launch()
    s.trackAppOpen()
    s.trackAuthResolved(false)
    s.track('step_view', { step: 'city' })
    setVisibility('hidden')
    expect(sent()).toContainEqual({ name: 'step_view', step: 'city' })
    expect(sent()).toContainEqual({ name: 'page_hidden', step: 'city' })

    setVisibility('hidden')
    window.dispatchEvent(new Event('pagehide'))
    expect(sentNames().filter((n) => n === 'page_hidden')).toHaveLength(1)

    setVisibility('visible')
    setVisibility('hidden')
    expect(sentNames().filter((n) => n === 'page_hidden')).toHaveLength(2)
  })

  it('page_hidden during auth sends nothing: it could be a returning user', async () => {
    const s = await launch()
    s.trackAppOpen()
    setVisibility('hidden')
    expect(fetchMock).not.toHaveBeenCalled()
    s.trackAuthResolved(true)
    await vi.runAllTimersAsync()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('submit_ok goes out at once and ends tracking', async () => {
    const s = await launch()
    s.trackAuthResolved(false)
    s.track('step_view', { step: 'photo' })
    s.trackSubmitOk()
    expect(sentNames()).toContain('submit_ok')
    const count = sent().length
    s.track('photo_pick', { step: 'photo' })
    setVisibility('hidden')
    await vi.runAllTimersAsync()
    expect(sent()).toHaveLength(count)
  })

  describe('website Login screen', () => {
    it('sends nothing for a returning user who signs in', async () => {
      const s = await launch()
      s.trackAppOpen()
      s.trackLoginView()
      await vi.runAllTimersAsync()
      s.trackAuthResolved(true)
      await vi.runAllTimersAsync()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('reports an anonymous visitor who leaves from it', async () => {
      const s = await launch()
      s.trackAppOpen()
      s.trackLoginView()
      setVisibility('hidden')
      expect(sentNames()).toEqual(['app_open', 'login_view', 'page_hidden'])
    })

    it('reports a new user who signs in', async () => {
      const s = await launch()
      s.trackAppOpen()
      s.trackLoginView()
      s.trackAuthResolved(false)
      expect(sentNames()).toEqual(['app_open', 'login_view', 'auth_ok'])
    })

    it('stays silent on leaving once this browser has finished a signup', async () => {
      localStorage.setItem('luma_signup_done', '1')
      const s = await launch()
      s.trackAppOpen()
      s.trackLoginView()
      setVisibility('hidden')
      await vi.runAllTimersAsync()
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
