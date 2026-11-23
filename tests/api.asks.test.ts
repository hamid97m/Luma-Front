// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.unmock('../src/api.ts')

import { api } from '../src/api.js'

const ok = (body: unknown, status = 200) => ({ ok: true, status, json: () => Promise.resolve(body), text: () => Promise.resolve('') })

describe('api.asks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ state: 'landing', requesterName: 'Sara', question: 'reply' })))
  })
  afterEach(() => vi.unstubAllGlobals())

  const lastCall = () => {
    const calls = vi.mocked(fetch).mock.calls
    const [url, init] = calls[calls.length - 1]
    return { url: String(url), init: init as RequestInit & { headers: Record<string, string> } }
  }

  it('link(token, false) resolves anonymously (no Authorization) so the landing does not claim', async () => {
    await api.asks.link('tok/1', false)
    const { url, init } = lastCall()
    expect(url).toMatch(/\/asks\/link\/tok%2F1$/)
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('link(token) sends the raw initData', async () => {
    await api.asks.link('tok')
    expect(lastCall().init.headers.Authorization).toBe('mock_init_data')
  })

  it('create posts the contract body', async () => {
    await api.asks.create({ targetId: 't', question: 'date', memberIds: ['m'], linkCount: 2 })
    const { url, init } = lastCall()
    expect(url).toMatch(/\/asks$/)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ targetId: 't', question: 'date', memberIds: ['m'], linkCount: 2 })
  })

  it('answer omits an empty note; events tolerate 204', async () => {
    await api.asks.answerForMe('r1', 'yes')
    expect(JSON.parse(String(lastCall().init.body))).toEqual({ verdict: 'yes' })
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.reject(new Error('no body')) } as never)
    await expect(api.asks.event({ name: 'ask_tooltip_shown' })).resolves.toBeUndefined()
  })
})
