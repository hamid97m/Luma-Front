// Signup funnel tracking: anonymous events that show where new users drop off.
// Never throws, never touches the UI and never goes through api.ts `request`
// (which can end the session). All state is module-level on purpose: it has to
// survive the keyed <App> remount on a locale change (see main.tsx), which also
// re-runs App's launch effects — as does StrictMode in dev — hence the dedupes.
import { useLocaleStore } from './i18n.js'
import { authHeader, isInsideTelegram } from './session.js'
import { isReturningUser } from './utils/returningUser.js'

export type SignupEventName =
  | 'app_open' | 'auth_ok' | 'auth_failed' | 'login_view' | 'picker_view' | 'picker_done'
  | 'step_view' | 'photo_pick' | 'photo_ok' | 'photo_failed' | 'submit_ok' | 'submit_failed'
  | 'page_hidden'

export type SignupStep = 'picker' | 'name' | 'city' | 'age' | 'gender' | 'pref' | 'interests' | 'photo'

interface SignupEvent {
  name: SignupEventName
  step?: SignupStep
  detail?: string
}

const BASE = import.meta.env.VITE_API_URL as string
const FLUSH_DELAY_MS = 1500
const MAX_EVENTS_PER_POST = 20
const DETAIL_RE = /^[a-z0-9_:.-]{1,32}$/
// Sent at most once per launch (per detail), however many times App remounts.
const ONCE: ReadonlySet<SignupEventName> = new Set<SignupEventName>([
  'app_open', 'auth_ok', 'auth_failed', 'login_view', 'picker_view', 'picker_done', 'submit_ok',
])
// isReturningUser only knows Telegram accounts; this covers the website.
const SIGNUP_DONE_KEY = 'luma_signup_done'

// pending: who this is isn't known yet, so events only buffer.
// open:    a new/incomplete user — events go out.
// closed:  returning user, banned, or signup finished — everything is ignored.
let gate: 'pending' | 'open' | 'closed' = 'pending'
// On the website Login screen nobody is signed in, so the gate stays pending
// (a returning user who signs in must leave no trace), but leaving the page
// from there is a real drop-off: `anonymous` lets page_hidden open the gate.
let anonymous = false
let buffer: SignupEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let sessionId: string | null = null
let currentStep: SignupStep | undefined
let lastStepView: SignupStep | undefined
let hiddenSent = false
let listening = false
const sentOnce = new Set<string>()

function quietly(fn: () => void): void {
  try {
    fn()
  } catch { /* tracking must never affect the app */ }
}

function newSessionId(): string {
  const c = globalThis.crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  // Older webviews, or a non-secure context: build the same UUID v4 by hand.
  const bytes = new Uint8Array(16)
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(bytes)
  else bytes.forEach((_, i) => { bytes[i] = Math.floor(Math.random() * 256) })
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** One random id per launch. */
export function getSignupSessionId(): string {
  sessionId ??= newSessionId()
  return sessionId
}

/** Short failure code from an error: `401`, `network`, `file:401`, `file:network`.
 *  Reads only the numeric status — never the error's text. */
export function signupErrorDetail(err: unknown, prefix?: string): string {
  const status = (err as { status?: unknown } | null | undefined)?.status
  const code = typeof status === 'number' && status > 0 ? String(status) : 'network'
  return prefix ? `${prefix}:${code}` : code
}

function send(events: SignupEvent[]): void {
  quietly(() => {
    fetch(`${BASE}/signup-events`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({
        sessionId: getSignupSessionId(),
        platform: isInsideTelegram() ? 'telegram' : 'web',
        locale: useLocaleStore.getState().locale,
        events,
      }),
    }).catch(() => {})
  })
}

function clearFlushTimer(): void {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
}

function flush(): void {
  clearFlushTimer()
  if (gate !== 'open') return
  const events = buffer
  buffer = []
  for (let i = 0; i < events.length; i += MAX_EVENTS_PER_POST) {
    send(events.slice(i, i + MAX_EVENTS_PER_POST))
  }
}

function openGate(): void {
  if (gate === 'closed') return
  gate = 'open'
  anonymous = false
  flush()
}

function closeGate(): void {
  gate = 'closed'
  anonymous = false
  buffer = []
  clearFlushTimer()
}

/** Stop for this launch, sending whatever was already due to go out. */
export function stopSignupTracking(): void {
  quietly(() => {
    flush()
    closeGate()
  })
}

function rememberSignupDone(): void {
  quietly(() => localStorage.setItem(SIGNUP_DONE_KEY, '1'))
}

function isKnownReturning(): boolean {
  try {
    return isReturningUser() || localStorage.getItem(SIGNUP_DONE_KEY) !== null
  } catch {
    return false
  }
}

/** Record an event. `detail` must be a short code; anything else is dropped. */
export function track(name: SignupEventName, opts: { step?: SignupStep; detail?: string } = {}): void {
  quietly(() => {
    if (gate === 'closed') return
    const { step } = opts
    const detail = opts.detail !== undefined && DETAIL_RE.test(opts.detail) ? opts.detail : undefined
    if (ONCE.has(name)) {
      const key = `${name}|${detail ?? ''}`
      if (sentOnce.has(key)) return
      sentOnce.add(key)
    }
    if (name === 'step_view') {
      if (step === lastStepView) return
      lastStepView = step
    }
    if (name === 'step_view' || name === 'picker_view') currentStep = step
    buffer.push({ name, ...(step ? { step } : {}), ...(detail ? { detail } : {}) })
    if (name === 'page_hidden') flush()
    else if (gate === 'open') flushTimer ??= setTimeout(flush, FLUSH_DELAY_MS)
  })
}

function onPageHidden(): void {
  if (gate === 'closed' || hiddenSent) return
  if (gate === 'pending') {
    // Still authenticating: this may be a returning user, send nothing.
    if (!anonymous) return
    openGate()
  }
  hiddenSent = true
  track('page_hidden', { step: currentStep })
}

function listen(): void {
  if (listening || typeof document === 'undefined') return
  listening = true
  document.addEventListener('visibilitychange', () => quietly(() => {
    if (document.visibilityState === 'hidden') onPageHidden()
    else hiddenSent = false
  }))
  // Some webviews tear down without a visibilitychange. Deduped by hiddenSent.
  window.addEventListener('pagehide', () => quietly(onPageHidden))
}

/** Launch. Held in the buffer until auth says whether to track this user. */
export function trackAppOpen(): void {
  quietly(listen)
  track('app_open')
}

/** A user signed in: a finished profile silences the tracker for this launch
 *  (dropping app_open), anything else starts tracking. */
export function trackAuthResolved(setupComplete: boolean): void {
  quietly(() => {
    if (setupComplete) {
      rememberSignupDone()
      closeGate()
      return
    }
    track('auth_ok')
    openGate()
  })
}

/** Auth failed for a reason other than a ban. */
export function trackAuthFailed(err: unknown): void {
  quietly(() => {
    // This device has finished a signup before: not a signup drop-off.
    if (isKnownReturning()) {
      closeGate()
      return
    }
    track('auth_failed', { detail: signupErrorDetail(err) })
    openGate()
  })
}

/** The website Login screen is showing. */
export function trackLoginView(): void {
  quietly(() => {
    track('login_view')
    if (gate === 'pending' && !isKnownReturning()) anonymous = true
  })
}

/** Signup finished: send what's left and stop. */
export function trackSubmitOk(): void {
  quietly(() => {
    rememberSignupDone()
    track('submit_ok')
    stopSignupTracking()
  })
}
