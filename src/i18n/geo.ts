/** IP-country lookup for the first-open language default.
 *
 * Served by the Vercel Edge Function in `api/geo.ts`, which just echoes the
 * `x-vercel-ip-country` header — same origin, no third-party geo service.
 * Only requested when the picker will actually be shown (brand-new user), and
 * memoised so the picker can read the result synchronously when it mounts.
 * Any failure (dev server, timeout, offline) resolves to null → the Telegram
 * language rule alone decides. */

const GEO_TIMEOUT_MS = 2500

let promise: Promise<string | null> | null = null
let resolved: string | null | undefined

async function lookup(): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), GEO_TIMEOUT_MS)
    const res = await fetch('/api/geo', { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(timer)
    if (!res.ok) return null
    const { country } = (await res.json()) as { country?: unknown }
    return typeof country === 'string' && /^[A-Z]{2}$/.test(country) ? country : null
  } catch {
    return null
  }
}

/** Start (or reuse) the lookup. Safe to call repeatedly. */
export function prefetchGeoCountry(): Promise<string | null> {
  if (!promise) {
    promise = lookup().then((c) => {
      resolved = c
      return c
    })
  }
  return promise
}

/** Result so far: a country code, null (looked up, unknown), or undefined (not resolved yet). */
export function geoCountrySync(): string | null | undefined {
  return resolved
}

/** Test hook — forget any in-flight or cached lookup. */
export function resetGeoForTests(): void {
  promise = null
  resolved = undefined
}
