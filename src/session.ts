// Website sign-in session. Outside Telegram there is no initData to resend, so
// the backend hands out a session token that we keep here and send as Bearer.
const SESSION_KEY = 'luma_session'

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

// Storage can throw (private / sandboxed browsers). Signing in must still
// work for this page load, so failures are swallowed.
export function setSessionToken(token: string): void {
  try {
    localStorage.setItem(SESSION_KEY, token)
  } catch { /* not persisted */ }
}

export function clearSessionToken(): void {
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

/** End the website session. A sign-out also forgets the stored token; a ban
 *  keeps it so the next launch lands on the Blocked screen again. */
export function endSession(end: SessionEnd): void {
  if (end.kind === 'signedOut') clearSessionToken()
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
