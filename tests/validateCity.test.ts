import { describe, it, expect } from 'vitest'
import { cityError, isValidCity } from '../src/utils/validateCity.js'

describe('isValidCity', () => {
  it('accepts a trimmed city with letters', () => {
    expect(isValidCity('  تهران  ')).toBe(true)
    expect(isValidCity('New York')).toBe(true)
    expect(isValidCity('شیراز')).toBe(true)
  })

  it('rejects empty, short, digit, and symbol-only values', () => {
    expect(cityError('')).toBe('empty')
    expect(cityError('   ')).toBe('empty')
    expect(cityError('ت')).toBe('invalid')
    expect(cityError('---')).toBe('invalid')
    expect(cityError('تهران2')).toBe('digits')
    expect(cityError('تهران۲')).toBe('digits')
    expect(cityError('ا'.repeat(41))).toBe('too_long')
    expect(isValidCity('ا'.repeat(40))).toBe(true)
  })
})
