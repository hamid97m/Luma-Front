// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.unmock('../src/api.ts')

import { api } from '../src/api.js'

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
})
