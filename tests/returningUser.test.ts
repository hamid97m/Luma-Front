import { describe, it, expect, beforeEach } from 'vitest'
import { RETURNING_USER_KEY, isReturningUser, markReturningUser, clearReturningUser } from '../src/utils/returningUser.js'

describe('returningUser helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is not a returning user before marking', () => {
    expect(isReturningUser()).toBe(false)
  })

  it('is a returning user after marking, for the mocked Telegram id', () => {
    markReturningUser()
    expect(isReturningUser()).toBe(true)
    expect(localStorage.getItem(RETURNING_USER_KEY)).toBe('123')
  })

  it('is no longer a returning user after clearing', () => {
    markReturningUser()
    clearReturningUser()
    expect(isReturningUser()).toBe(false)
    expect(localStorage.getItem(RETURNING_USER_KEY)).toBeNull()
  })
})
