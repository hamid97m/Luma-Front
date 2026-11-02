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

export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_KEY, token)
}

export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_KEY)
}

/** Opened as a Telegram Mini App. Telegram always wins: initData auth, and
 *  any stored session token is ignored. */
export function isInsideTelegram(): boolean {
  return !!window.Telegram?.WebApp?.initData
}
