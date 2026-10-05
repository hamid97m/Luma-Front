import { describe, it, expect, afterEach } from 'vitest'
import { useLocaleStore } from '../src/i18n.js'
import { formatShortDate, formatFullDate, formatTime } from '../src/i18n/format.js'

const d = new Date('2026-03-21T12:00:00Z') // 1 Farvardin 1405

describe('date formatting per locale', () => {
  afterEach(() => useLocaleStore.getState().setLocale('fa'))

  it('fa uses the Jalali calendar with Latin digits', () => {
    useLocaleStore.getState().setLocale('fa')
    const s = formatFullDate(d)
    expect(s).toMatch(/1405/)
    expect(s).not.toMatch(/[۰-۹]/)
    expect(formatTime(d)).not.toMatch(/[۰-۹]/)
  })
  it('en uses Gregorian', () => {
    useLocaleStore.getState().setLocale('en')
    expect(formatFullDate(d)).toMatch(/2026/)
    expect(formatShortDate(d)).toMatch(/Mar/)
  })
  it('ar uses Gregorian with Latin digits', () => {
    useLocaleStore.getState().setLocale('ar')
    const s = formatFullDate(d)
    expect(s).toMatch(/2026/)
    expect(s).not.toMatch(/[٠-٩]/)
    expect(formatTime(d)).not.toMatch(/[٠-٩]/)
  })
})
