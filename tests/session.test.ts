import { describe, it, expect, vi, afterEach } from 'vitest'
import { authHeader, clearSessionToken, endSession, getSessionToken, onSessionEnded, setSessionToken } from '../src/session.js'

describe('session token storage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearSessionToken()
  })

  it('keeps the token for this page load when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })

    setSessionToken('web-token')

    expect(getSessionToken()).toBe('web-token')
  })

  it('keeps the token when storage silently drops writes', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })

    setSessionToken('web-token')

    expect(getSessionToken()).toBe('web-token')
  })

  it('clear forgets the in-memory copy too', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    setSessionToken('web-token')

    clearSessionToken()

    expect(getSessionToken()).toBeNull()
  })
})

describe('authHeader', () => {
  const wa = window.Telegram!.WebApp! as { initData: string }
  const initData = wa.initData

  afterEach(() => {
    wa.initData = initData
    clearSessionToken()
  })

  it('inside Telegram sends initData, even with a stored web token', () => {
    setSessionToken('web-token')
    expect(authHeader()).toEqual({ Authorization: initData })
  })

  it('outside Telegram sends the session as Bearer, or nothing', () => {
    wa.initData = ''
    expect(authHeader()).toEqual({})
    setSessionToken('web-token')
    expect(authHeader()).toEqual({ Authorization: 'Bearer web-token' })
  })
})

describe('endSession', () => {
  const originalLocation = window.location

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
    clearSessionToken()
  })

  it('sign-out clears the token and reloads so no old account state survives', () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } })
    setSessionToken('web-token')

    endSession({ kind: 'signedOut' })

    expect(getSessionToken()).toBeNull()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('a ban keeps the token, notifies listeners and does not reload', () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } })
    const ended = vi.fn()
    const off = onSessionEnded(ended)
    setSessionToken('web-token')

    endSession({ kind: 'banned', error: new Error('account_banned') })

    expect(ended).toHaveBeenCalledWith({ kind: 'banned', error: expect.any(Error) })
    expect(getSessionToken()).toBe('web-token')
    expect(reload).not.toHaveBeenCalled()
    off()
  })
})
