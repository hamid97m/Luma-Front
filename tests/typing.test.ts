import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { dispatch, toRealtimeEvent } from '../src/realtime.js'
import { TYPING_TTL_MS, clearTyping, markTyping, resetTyping, useTypingStore } from '../src/typing.js'
import { leadingThrottle } from '../src/utils/throttle.js'
import type { Message } from '../src/types.js'

const typingIn = () => useTypingStore.getState().byMatch

const msg = (senderId: string): Message =>
  ({ id: 'x', senderId, body: 'hi', createdAt: '2026-01-01T10:00:00Z', readAt: null, type: 'text', replyToMessageId: null })

describe('typing store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetTyping()
  })
  afterEach(() => vi.useRealTimers())

  it('parses the SSE typing event', () => {
    expect(toRealtimeEvent({ event: 'typing', data: '{"matchId":"m1","userId":"u1"}' }))
      .toEqual({ type: 'typing', matchId: 'm1', userId: 'u1' })
    expect(toRealtimeEvent({ event: 'typing', data: '{"matchId":"m1"}' })).toBeNull()
  })

  it('a typing event shows for TYPING_TTL_MS, each new event extends it', () => {
    dispatch({ type: 'typing', matchId: 'm1', userId: 'u1' })
    expect(typingIn()).toEqual({ m1: 'u1' })
    vi.advanceTimersByTime(TYPING_TTL_MS - 1000)
    dispatch({ type: 'typing', matchId: 'm1', userId: 'u1' })
    vi.advanceTimersByTime(TYPING_TTL_MS - 1000)
    expect(typingIn()).toEqual({ m1: 'u1' })
    vi.advanceTimersByTime(1000)
    expect(typingIn()).toEqual({})
  })

  it('tracks chats independently', () => {
    markTyping('m1', 'u1')
    vi.advanceTimersByTime(3000)
    markTyping('m2', 'u2')
    vi.advanceTimersByTime(TYPING_TTL_MS - 3000)
    expect(typingIn()).toEqual({ m2: 'u2' })
  })

  it('their message in that chat clears it at once; mine or another chat does not', () => {
    markTyping('m1', 'u1')
    dispatch({ type: 'message', matchId: 'm1', message: msg('me') })
    dispatch({ type: 'message', matchId: 'm2', message: msg('u1') })
    expect(typingIn()).toEqual({ m1: 'u1' })
    dispatch({ type: 'message', matchId: 'm1', message: msg('u1') })
    expect(typingIn()).toEqual({})
  })

  it('a cleared entry does not get removed again by its stale timer', () => {
    markTyping('m1', 'u1')
    clearTyping('m1')
    markTyping('m1', 'u1')
    vi.advanceTimersByTime(TYPING_TTL_MS - 1)
    expect(typingIn()).toEqual({ m1: 'u1' })
  })
})

describe('leadingThrottle', () => {
  it('runs the first call, drops calls within the interval, then lets one through', () => {
    let now = 0
    const fn = vi.fn()
    const th = leadingThrottle(fn, 3000, () => now)
    th.call()
    expect(fn).toHaveBeenCalledTimes(1)
    now = 1000; th.call()
    now = 2999; th.call()
    expect(fn).toHaveBeenCalledTimes(1)
    now = 3000; th.call()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('reset() lets the next call through immediately', () => {
    let now = 0
    const fn = vi.fn()
    const th = leadingThrottle(fn, 3000, () => now)
    th.call()
    now = 500; th.reset(); th.call()
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
