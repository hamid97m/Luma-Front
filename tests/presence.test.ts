import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { dispatch, toRealtimeEvent, useRealtimeStore } from '../src/realtime.js'
import { resetPresence, seedPresence, setPresence, useIsOnline, usePresenceStore } from '../src/presence.js'
import { useAuthStore } from '../src/store.js'
import type { Match, UserProfile } from '../src/types.js'

const byUser = () => usePresenceStore.getState().byUser

const match = (userId: string, online?: boolean): Match => ({
  id: `m-${userId}`,
  matchedAt: '2026-01-01T00:00:00Z',
  user: { id: userId, name: userId, photos: [], telegramId: 1, username: null, age: null, bio: null, icebreakerPrompt: null, icebreakerAnswer: null, online },
  lastMessage: null,
  unreadCount: 0,
})

describe('presence store', () => {
  beforeEach(() => {
    useRealtimeStore.setState({ connected: true })
    useAuthStore.setState({ user: { id: 'me-1' } as UserProfile })
    resetPresence()
  })

  it('parses the SSE presence event and drops malformed ones', () => {
    expect(toRealtimeEvent({ event: 'presence', data: '{"userId":"u1","online":true}' }))
      .toEqual({ type: 'presence', userId: 'u1', online: true })
    expect(toRealtimeEvent({ event: 'presence', data: '{"userId":"u1","online":false}' }))
      .toEqual({ type: 'presence', userId: 'u1', online: false })
    expect(toRealtimeEvent({ event: 'presence', data: '{"userId":"u1"}' })).toBeNull()
    expect(toRealtimeEvent({ event: 'presence', data: '{"userId":"u1","online":"yes"}' })).toBeNull()
    expect(toRealtimeEvent({ event: 'presence', data: '{"online":true}' })).toBeNull()
    expect(toRealtimeEvent({ event: 'presence', data: 'null' })).toBeNull()
    expect(toRealtimeEvent({ event: 'presence', data: 'nope' })).toBeNull()
  })

  it('seeds from a matches list, overwriting earlier values; missing flag = offline', () => {
    setPresence('u3', true)
    seedPresence([match('u1', true), match('u2', false), match('u3')])
    expect(byUser()).toEqual({ u1: true, u2: false, u3: false })
  })

  it('presence events update a user', () => {
    seedPresence([match('u1', false)])
    dispatch({ type: 'presence', userId: 'u1', online: true })
    expect(byUser().u1).toBe(true)
    dispatch({ type: 'presence', userId: 'u1', online: false })
    expect(byUser().u1).toBe(false)
  })

  it('is cleared when the stream disconnects and hidden while it is down', () => {
    seedPresence([match('u1', true)])
    const { result } = renderHook(() => useIsOnline('u1'))
    expect(result.current).toBe(true)
    act(() => useRealtimeStore.setState({ connected: false }))
    expect(byUser()).toEqual({})
    expect(result.current).toBe(false)
    // A fallback-poll seed while down still shows nothing until reconnect.
    act(() => seedPresence([match('u1', true)]))
    expect(result.current).toBe(false)
    act(() => useRealtimeStore.setState({ connected: true }))
    expect(result.current).toBe(true)
  })

  it('never reports me as online', () => {
    setPresence('me-1', true)
    const { result } = renderHook(() => useIsOnline('me-1'))
    expect(result.current).toBe(false)
  })
})
