import { newUuid } from './utils/uuid.js'

// Website sign-in session. Outside Telegram there is no initData to resend, so
// the backend hands out a session token that we keep here and send as Bearer.
const SESSION_KEY = 'luma_session'

// In-memory copy: storage can throw or drop writes (private / sandboxed
// browsers), and signing in must still work for this page load.
let memoryToken: string | null = null

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY) ?? memoryToken
  } catch {
    return memoryToken
  }
}

export function setSessionToken(token: string): void {
  memoryToken = token
  try {
    localStorage.setItem(SESSION_KEY, token)
  } catch { /* not persisted — the memory copy covers this page load */ }
}

export function clearSessionToken(): void {
  memoryToken = null
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch { /* nothing stored */ }
}

/** How a website session ended mid-use: logged out / rejected by the server
 *  (→ Login screen), or the account was banned (→ Blocked screen). */
export type SessionEnd = { kind: 'signedOut' } | { kind: 'banned'; error: unknown }

type SessionEndListener = (end: SessionEnd) => void
const sessionEndListeners = new Set<SessionEndListener>()

/** Subscribe to the website session ending. Returns an unsubscribe. */
export function onSessionEnded(fn: SessionEndListener): () => void {
  sessionEndListeners.add(fn)
  return () => { sessionEndListeners.delete(fn) }
}

/** End the website session. A sign-out forgets the stored token and reloads
 *  the page, so no state from the old account survives (the fresh launch has
 *  no token and shows Login). A ban keeps the token so the next launch lands
 *  on the Blocked screen again. */
export function endSession(end: SessionEnd): void {
  if (end.kind === 'signedOut') {
    clearSessionToken()
    window.location.reload()
    return
  }
  for (const fn of sessionEndListeners) fn(end)
}

/** Opened as a Telegram Mini App. Telegram always wins: initData auth, and
 *  any stored session token is ignored. */
export function isInsideTelegram(): boolean {
  return !!window.Telegram?.WebApp?.initData
}

/** Authorization for every API call and the realtime stream. Inside Telegram:
 *  the raw initData, as always (a stored web token is ignored). On the
 *  website: the session token as Bearer, if signed in. */
export function authHeader(): Record<string, string> {
  if (isInsideTelegram()) return { Authorization: window.Telegram?.WebApp?.initData ?? '' }
  const token = getSessionToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const DEVICE_KEY = 'luma_device_id'
let memoryDeviceId: string | null = null

/** Stable per-install id: kept in localStorage, in memory when storage fails. */
export function getDeviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_KEY)
    if (stored) return stored
  } catch { /* fall through to memory */ }
  memoryDeviceId ??= newUuid()
  try {
    localStorage.setItem(DEVICE_KEY, memoryDeviceId)
  } catch { /* not persisted — the memory copy is stable for this page load */ }
  return memoryDeviceId
}

/** authHeader() plus the client/device identification headers sent to the API. */
export function clientHeaders(): Record<string, string> {
  const inTelegram = isInsideTelegram()
  const model = inTelegram ? window.Telegram?.WebApp?.platform : undefined
  return {
    ...authHeader(),
    'X-Client-Platform': inTelegram ? 'telegram' : 'web',
    'X-Client-Version': __APP_VERSION__,
    'X-Device-Id': getDeviceId(),
    ...(model ? { 'X-Device-Model': model } : {}),
  }
}
