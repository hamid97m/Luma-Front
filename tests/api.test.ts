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

  it('attaches the HTTP status to thrown errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('match_not_found'),
    }))

    await expect(api.matches.list()).rejects.toMatchObject({ status: 404 })
  })
})
