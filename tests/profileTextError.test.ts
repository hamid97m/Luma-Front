import { describe, it, expect } from 'vitest'
import { profileTextError, profileTextMessage } from '../src/utils/profileTextError.js'

const httpErr = (status: number, body: unknown) =>
  Object.assign(new Error(typeof body === 'string' ? body : JSON.stringify(body)), { status })

describe('profileTextError', () => {
  it('parses a 422 rejection', () => {
    expect(profileTextError(httpErr(422, { error: 'profile_text_rejected', field: 'bio', reason: 'contact_info' })))
      .toEqual({ kind: 'rejected', field: 'bio', reason: 'contact_info' })
  })

  it('parses the 429 check limit but not the generic rate limit', () => {
    expect(profileTextError(httpErr(429, { error: 'profile_text_check_limit' }))).toEqual({ kind: 'limit' })
    expect(profileTextError(httpErr(429, { statusCode: 429, error: 'Too Many Requests' }))).toBeNull()
  })

  it('maps an unknown reason to the generic copy', () => {
    expect(profileTextError(httpErr(422, { error: 'profile_text_rejected', field: 'name', reason: 'new_thing' })))
      .toEqual({ kind: 'rejected', field: 'name', reason: 'other' })
  })

  it('ignores other errors', () => {
    expect(profileTextError(httpErr(500, 'boom'))).toBeNull()
    expect(profileTextError(httpErr(422, 'not json'))).toBeNull()
    expect(profileTextError(httpErr(422, { error: 'invalid_age' }))).toBeNull()
    expect(profileTextError(new TypeError('Failed to fetch'))).toBeNull()
    expect(profileTextError('x')).toBeNull()
  })

  it('builds the Persian message with the field name', () => {
    expect(profileTextMessage({ kind: 'rejected', field: 'bio', reason: 'contact_info' }))
      .toBe('آیدی، شماره تلفن یا لینک در بیو مجاز نیست. لطفاً حذفش کن.')
    expect(profileTextMessage({ kind: 'rejected', field: 'icebreaker_answer', reason: 'offensive' }))
      .toBe('جواب سؤال شامل کلمات توهین‌آمیز است. لطفاً ویرایشش کن.')
    expect(profileTextMessage({ kind: 'rejected', field: 'name', reason: 'fake_name' }))
      .toBe('این اسم واقعی به نظر نمی‌رسه. لطفاً اسم واقعی خودت رو بنویس.')
    expect(profileTextMessage({ kind: 'limit' })).toBe('تلاش‌های زیادی انجام دادی. کمی بعد دوباره امتحان کن.')
  })
})
