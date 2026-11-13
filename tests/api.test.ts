// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.unmock('../src/api.ts')

import { api, onAccountPaused } from '../src/api.js'
import { setSessionToken, clearSessionToken, getSessionToken, onSessionEnded } from '../src/session.js'

describe('api request', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ matched: false }),
    }))
  })

  it('sends swipe requests with keepalive so they survive app teardown', async () => {
    await api.swipes.swipe('target-id', 'like')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/swipes'),
      expect.objectContaining({ keepalive: true })
    )
  })

  it('fetches messages for a match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [] }),
    }))

    await api.messages.list('match-1')

    const [url, opts] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/matches/match-1/messages')
    expect(opts?.method).toBeUndefined()
  })

  it('sends a message with the trimmed-by-server body as JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: { id: 'm1', senderId: 'u1', body: 'hi', createdAt: '2026-01-01T00:00:00Z' } }),
    }))

    await api.messages.send('match-1', 'hi')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/matches/match-1/messages'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ body: 'hi' }) })
    )
  })

  it('edits a message via PATCH with the new body as JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: { id: 'm1', senderId: 'u1', body: 'fixed', createdAt: '2026-01-01T00:00:00Z', readAt: null, editedAt: '2026-01-02T00:00:00Z' } }),
    }))

    await api.messages.edit('match-1', 'm1', 'fixed')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/matches/match-1/messages/m1'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ body: 'fixed' }) })
    )
  })

  it('deletes a message via DELETE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    }))

    await api.messages.delete('match-1', 'm1')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/matches/match-1/messages/m1'),
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('notifies listeners on a mid-session account_paused 403', async () => {
    const heard = vi.fn()
    const off = onAccountPaused(heard)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve(JSON.stringify({ error: 'account_paused' })),
    }))

    await expect(api.swipes.swipe('them', 'like')).rejects.toMatchObject({ status: 403 })
    expect(heard).toHaveBeenCalledTimes(1)

    off()
    await expect(api.swipes.swipe('them', 'like')).rejects.toMatchObject({ status: 403 })
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('does not notify on other 403s', async () => {
    const heard = vi.fn()
    const off = onAccountPaused(heard)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve(JSON.stringify({ error: 'swipe_limit' })),
    }))

    await expect(api.swipes.swipe('them', 'like')).rejects.toMatchObject({ status: 403 })
    expect(heard).not.toHaveBeenCalled()
    off()
  })

  it('attaches the HTTP status to thrown errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('match_not_found'),
    }))

    await expect(api.matches.list()).rejects.toMatchObject({ status: 404 })
  })
})

describe('api request auth header', () => {
  const TG_INIT_DATA = window.Telegram!.WebApp!.initData

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }))
  })

  afterEach(() => {
    ;(window.Telegram!.WebApp! as { initData: string }).initData = TG_INIT_DATA
    clearSessionToken()
  })

  it('sends Bearer <token> outside Telegram', async () => {
    ;(window.Telegram!.WebApp! as { initData: string }).initData = ''
    setSessionToken('web-token')

    await api.matches.list()

    const [, opts] = vi.mocked(fetch).mock.calls[0]
    expect((opts?.headers as Record<string, string>).Authorization).toBe('Bearer web-token')
  })

  it('sends initData inside Telegram even with a stored token', async () => {
    setSessionToken('web-token')

    await api.matches.list()

    const [, opts] = vi.mocked(fetch).mock.calls[0]
    expect((opts?.headers as Record<string, string>).Authorization).toBe(TG_INIT_DATA)
  })

  it('GET /auth/me sends the token and no JSON content-type', async () => {
    ;(window.Telegram!.WebApp! as { initData: string }).initData = ''
    setSessionToken('web-token')

    await api.auth.me()

    const [url, opts] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/auth/me')
    expect(opts?.method).toBeUndefined()
    const headers = opts?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer web-token')
    expect(headers['Content-Type']).toBeUndefined()
  })

  it('body-less POST /auth/dev sends no JSON content-type', async () => {
    ;(window.Telegram!.WebApp! as { initData: string }).initData = ''

    await api.auth.dev()

    const [url, opts] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/auth/dev')
    expect(opts?.method).toBe('POST')
    expect((opts?.headers as Record<string, string>)['Content-Type']).toBeUndefined()
  })

  it('posts the Google credential and the Telegram widget payload as JSON', async () => {
    ;(window.Telegram!.WebApp! as { initData: string }).initData = ''
    const widget = { id: 1, first_name: 'Ali', auth_date: 1, hash: 'h' }

    await api.auth.google('id-token')
    await api.auth.telegramWeb(widget)

    const calls = vi.mocked(fetch).mock.calls
    expect(calls[0][0]).toContain('/auth/google')
    expect(calls[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ credential: 'id-token' }) })
    expect(calls[1][0]).toContain('/auth/telegram-web')
    expect(calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify(widget) })
  })
})

describe('api request: rejected website session', () => {
  const TG_INIT_DATA = window.Telegram!.WebApp!.initData
  const reply401 = (body: object) =>
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify(body)),
    }))
  const originalLocation = window.location
  let ended: ReturnType<typeof vi.fn>
  let reload: ReturnType<typeof vi.fn>
  let unsubscribe: () => void

  beforeEach(() => {
    reload = vi.fn()
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } })
    ended = vi.fn()
    unsubscribe = onSessionEnded(ended)
    setSessionToken('web-token')
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
    unsubscribe()
    clearSessionToken()
    ;(window.Telegram!.WebApp! as { initData: string }).initData = TG_INIT_DATA
  })

  it('outside Telegram, a 401 mid-session clears the token and signs out', async () => {
    ;(window.Telegram!.WebApp! as { initData: string }).initData = ''
    reply401({ error: 'invalid_session' })

    await expect(api.profile.get()).rejects.toMatchObject({ status: 401 })

    expect(getSessionToken()).toBeNull()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('outside Telegram, account_banned mid-session reports a ban and keeps the token', async () => {
    ;(window.Telegram!.WebApp! as { initData: string }).initData = ''
    reply401({ error: 'account_banned', botUsername: 'LumaDatingBot' })

    const err = await api.profile.get().catch((e: unknown) => e)

    expect(ended).toHaveBeenCalledWith({ kind: 'banned', error: err })
    expect(getSessionToken()).toBe('web-token')
    expect(reload).not.toHaveBeenCalled()
  })

  it('outside Telegram, a 401 from a sign-in call is left to the caller', async () => {
    ;(window.Telegram!.WebApp! as { initData: string }).initData = ''
    reply401({ error: 'invalid_google_login' })

    await expect(api.auth.google('bad')).rejects.toMatchObject({ status: 401 })
    await expect(api.auth.me()).rejects.toMatchObject({ status: 401 })

    expect(ended).not.toHaveBeenCalled()
    expect(getSessionToken()).toBe('web-token')
  })

  it('inside Telegram, a 401 changes nothing', async () => {
    reply401({ error: 'invalid_init_data' })

    await expect(api.profile.get()).rejects.toMatchObject({ status: 401 })

    expect(ended).not.toHaveBeenCalled()
    expect(getSessionToken()).toBe('web-token')
  })
})
