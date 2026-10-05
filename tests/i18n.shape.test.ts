import { describe, it, expect } from 'vitest'
import { fa } from '../src/locales/fa.js'
import { en } from '../src/locales/en.js'
// TODO(Task 9b): import { ar } from '../src/locales/ar.js' and add it to every check below.

function shape(obj: any, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'function') out[p] = `fn:${v.length}`
    else if (Array.isArray(v)) out[p] = `array:${v.length}`
    else if (v && typeof v === 'object') Object.assign(out, shape(v, p))
    else out[p] = typeof v
  }
  return out
}

const walkStrings = (o: any, path: string, visit: (value: string, path: string) => void) => {
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string') visit(v, `${path}.${k}`)
    else if (v && typeof v === 'object') walkStrings(v, `${path}.${k}`, visit)
  }
}

describe('frontend locale shape', () => {
  const base = shape(fa)

  it('en matches fa key-for-key (incl. function arity and array length)', () => {
    expect(shape(en)).toEqual(base)
  })

  it('no empty strings', () => {
    for (const loc of [en]) {
      for (const [k, kind] of Object.entries(shape(loc))) {
        if (kind !== 'string') continue
        expect(k.split('.').reduce((o: any, p) => o[p], loc), k).not.toBe('')
      }
    }
  })

  it('no Persian-only glyphs leak into en', () => {
    const persianOnly = /[\u067E\u0686\u0698\u06AF\u06A9\u06CC]/ // پ چ ژ گ ک ی
    walkStrings(en, 'en', (v, path) => expect(v, path).not.toMatch(persianOnly))
  })

  it('en contains no Arabic-script characters at all', () => {
    const arabicScript = /[\u0600-\u06FF]/
    walkStrings(en, 'en', (v, path) => expect(v, path).not.toMatch(arabicScript))
  })
})
