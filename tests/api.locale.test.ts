// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.unmock('../src/api.ts')

import { api } from '../src/api.js'

describe('api.profile.setLocale', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, locale: 'en' }),
    }))
  })

  it('PATCHes /profile/me/locale with the locale as JSON', async () => {
    const res = await api.profile.setLocale('en')

    expect(res).toEqual({ ok: true, locale: 'en' })
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toMatch(/\/profile\/me\/locale$/)
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual({ locale: 'en' })
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: 'mock_init_data' })
  })

  it('surfaces invalid_locale rejections with the HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('invalid_locale'),
    }))

    await expect(api.profile.setLocale('en')).rejects.toMatchObject({ status: 400, message: 'invalid_locale' })
  })
})
