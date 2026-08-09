// Central, version-guarded wrapper around the Telegram WebApp JS SDK
// (loaded via <script> tag as window.Telegram.WebApp).
//
// Every function here safely no-ops when running outside Telegram (browser
// dev, unit tests) or on an older client that lacks a given feature, so the
// rest of the app can call these unconditionally.
import { useEffect, useRef } from 'react'

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
type NotificationType = 'error' | 'success' | 'warning'

function webApp() {
  return window.Telegram?.WebApp
}

/** True if the connected Telegram client is at least the given Bot API version. */
function supports(version: string): boolean {
  return !!webApp()?.isVersionAtLeast?.(version)
}

// ---------------------------------------------------------------------------
// Haptics — tasteful physical feedback at meaningful moments.
// ---------------------------------------------------------------------------
export const haptic = {
  impact(style: ImpactStyle = 'medium') {
    webApp()?.HapticFeedback?.impactOccurred?.(style)
  },
  notification(type: NotificationType) {
    webApp()?.HapticFeedback?.notificationOccurred?.(type)
  },
  selection() {
    webApp()?.HapticFeedback?.selectionChanged?.()
  },
}

/** Open a t.me link inside Telegram; falls back to a new tab outside it. */
export function openTelegramLink(url: string): void {
  const wa = webApp()
  if (wa?.openTelegramLink) wa.openTelegramLink(url)
  else window.open(url, '_blank')
}

/** Close the Mini App (no-op outside Telegram). */
export function closeMiniApp(): void {
  webApp()?.close?.()
}

// ---------------------------------------------------------------------------
// Safe area — in fullscreen mode the app draws under Telegram's floating
// controls and the device status bar, so we mirror Telegram's own insets
// into CSS custom properties that layout code can pad with.
// ---------------------------------------------------------------------------
function writeSafeAreaVars() {
  const wa = webApp()
  if (!wa) return
  const sa = wa.safeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 }
  const csa = wa.contentSafeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 }
  const root = document.documentElement.style
  root.setProperty('--tg-safe-top', `${(sa.top ?? 0) + (csa.top ?? 0)}px`)
  root.setProperty('--tg-safe-bottom', `${(sa.bottom ?? 0) + (csa.bottom ?? 0)}px`)
  root.setProperty('--tg-safe-left', `${(sa.left ?? 0) + (csa.left ?? 0)}px`)
  root.setProperty('--tg-safe-right', `${(sa.right ?? 0) + (csa.right ?? 0)}px`)
}

// ---------------------------------------------------------------------------
// Theme — mirror Telegram's light/dark choice onto the document so the CSS
// token layer (index.css) flips, and paint Telegram's own chrome (header,
// background, bottom bar) to match our resolved app background. Reacts live to
// the client's `themeChanged` event.
// ---------------------------------------------------------------------------
// The user can override the Telegram-driven theme from Settings. 'system'
// (default) follows Telegram's color scheme; 'light'/'dark' pin it. Persisted
// so the choice survives reopens.
export type ThemePref = 'system' | 'light' | 'dark'
const THEME_KEY = 'luma_theme'

export function getThemePref(): ThemePref {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_KEY) : null
  return v === 'light' || v === 'dark' ? v : 'system'
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, pref)
  } catch {
    /* storage unavailable — fall through, theme still applies for this session */
  }
  applyTheme()
}

/** True if the app is currently rendering in dark mode. */
export function isDarkTheme(): boolean {
  return document.documentElement.dataset.theme === 'dark'
}

export function applyTheme() {
  const wa = webApp()
  const pref = getThemePref()
  // A pinned preference wins; otherwise follow Telegram, then the OS (browser dev).
  const scheme: 'light' | 'dark' =
    pref !== 'system'
      ? pref
      : wa?.colorScheme ??
        (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light')

  const root = document.documentElement
  if (scheme === 'dark') root.dataset.theme = 'dark'
  else delete root.dataset.theme

  if (!wa) return
  // Resolve the app background token now that data-theme is set, and hand it to
  // Telegram so its floating header / status bar / bottom bar blend with us.
  const bg =
    getComputedStyle(root).getPropertyValue('--bg').trim() ||
    (scheme === 'dark' ? '#1C1216' : '#FFF8F8')
  wa.setBackgroundColor?.(bg)
  wa.setHeaderColor?.(bg)
  wa.setBottomBarColor?.(bg)
}

// ---------------------------------------------------------------------------
// One-time app init — call once on mount.
// ---------------------------------------------------------------------------
export function initTelegram() {
  const wa = webApp()
  if (!wa) {
    // Still honor the OS color scheme in browser/dev so the redesign is testable.
    applyTheme()
    return
  }
  wa.ready?.()
  wa.expand?.()

  // Light/dark: apply now and follow the client's theme changes live.
  applyTheme()
  wa.onEvent?.('themeChanged', applyTheme)

  // Lock vertical swipes so dragging a card can't accidentally minimize the
  // Mini App (Bot API 7.7+).
  if (supports('7.7')) wa.disableVerticalSwipes?.()

  // True fullscreen + safe-area tracking (Bot API 8.0+). Falls back silently
  // to the expanded (non-fullscreen) state on failure or older clients.
  // Only request fullscreen on real phones — on desktop/web clients it blows
  // the Mini App up to fill the whole Telegram window; there we keep the
  // default window size and let the CSS phone-width frame (index.css #root) do
  // the constraining so the app reads as a centered mobile column instead.
  const isMobile = wa.platform === 'android' || wa.platform === 'ios'
  if (supports('8.0') && isMobile) {
    wa.requestFullscreen?.()
    wa.onEvent?.('safeAreaChanged', writeSafeAreaVars)
    wa.onEvent?.('contentSafeAreaChanged', writeSafeAreaVars)
    wa.onEvent?.('fullscreenChanged', writeSafeAreaVars)
  }
  writeSafeAreaVars()
}

// ---------------------------------------------------------------------------
// Back button — a single shared stack over Telegram's one native BackButton.
// Any overlay (chat, a bottom sheet, a full-screen editor) pushes a handler
// while it's open; the top of the stack is what a back-press (header arrow OR
// the Android hardware/again-swipe back, which Telegram routes to BackButton
// while it's visible) runs. The button shows whenever the stack is non-empty
// and hides when it empties. This is what stops a back-press from closing the
// whole Mini App while a sheet is open — it dismisses the sheet instead.
// ---------------------------------------------------------------------------
type BackHandler = () => void
const backStack: BackHandler[] = []
let backClickWired = false

function dispatchBack() {
  backStack[backStack.length - 1]?.()
}

function syncBackButton() {
  const bb = webApp()?.BackButton
  if (!bb) return
  if (backStack.length > 0) bb.show?.()
  else bb.hide?.()
}

/**
 * Register a back-press handler while an overlay is open. Returns an
 * unregister function — call it on close/unmount. LIFO: the most recently
 * pushed handler wins, and popping it restores the one beneath.
 */
export function pushBackHandler(handler: BackHandler): () => void {
  backStack.push(handler)
  const bb = webApp()?.BackButton
  if (bb && !backClickWired) {
    bb.onClick?.(dispatchBack) // wired once; dispatchBack always reads the top
    backClickWired = true
  }
  syncBackButton()
  return () => {
    const i = backStack.lastIndexOf(handler)
    if (i !== -1) backStack.splice(i, 1)
    syncBackButton()
  }
}

/**
 * Hook form: registers `handler` as the active back action whenever `active`
 * is true. The handler is read through a ref so its identity can change every
 * render without re-subscribing.
 */
export function useBackButton(active: boolean, handler: BackHandler): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!active) return
    return pushBackHandler(() => ref.current())
  }, [active])
}

// ---------------------------------------------------------------------------
// Bot write access — Telegram forbids bots from DMing users who never pressed
// Start or granted write access, so match/message notifications silently fail
// for them. requestWriteAccess() (Bot API 6.9+) shows a native one-tap
// permission popup inside the Mini App that fixes this without a /start trip.
// ---------------------------------------------------------------------------
let writeAccessGrantedThisSession = false
let writeAccessPromptedThisSession = false

/** True if the bot is known to be allowed to DM this user. */
export function botCanMessage(): boolean {
  if (writeAccessGrantedThisSession) return true
  return webApp()?.initDataUnsafe?.user?.allows_write_to_pm === true
}

/**
 * True when it's worth showing the in-app notifications explainer: running in
 * a Telegram client that has the popup, access not yet granted, and we haven't
 * already asked this session.
 */
export function shouldPromptWriteAccess(): boolean {
  if (writeAccessPromptedThisSession || botCanMessage()) return false
  return !!webApp()?.requestWriteAccess && supports('6.9')
}

export function markWriteAccessPrompted(): void {
  writeAccessPromptedThisSession = true
}

// Launch-time prompting is additionally rate-limited across sessions so a
// user who tapped "Not now" isn't nagged on every app open. Match-close
// prompting deliberately ignores this — that moment is high-intent.
const DISMISS_KEY = 'luma_notify_dismissed_at'
const PROMPT_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000

export function shouldPromptWriteAccessOnLaunch(): boolean {
  if (!shouldPromptWriteAccess()) return false
  const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
  return !dismissedAt || Date.now() - dismissedAt > PROMPT_COOLDOWN_MS
}

export function markWriteAccessDismissed(): void {
  localStorage.setItem(DISMISS_KEY, String(Date.now()))
}

/** Shows Telegram's native "Allow bot to message you?" popup. */
export function requestWriteAccess(): Promise<boolean> {
  return new Promise((resolve) => {
    const wa = webApp()
    if (!wa?.requestWriteAccess || !supports('6.9')) return resolve(false)
    try {
      wa.requestWriteAccess((granted) => {
        if (granted) writeAccessGrantedThisSession = true
        resolve(granted)
      })
    } catch {
      // Another native popup already open — treat as declined for now.
      resolve(false)
    }
  })
}

// ---------------------------------------------------------------------------
// Main button — the native docked button. We only "take over" a screen's
// primary action when Telegram actually provides a MainButton; otherwise the
// screen keeps rendering its own in-page button (browser dev, tests).
// ---------------------------------------------------------------------------
export function mainButtonSupported(): boolean {
  return !!webApp()?.MainButton
}

export interface MainButtonConfig {
  text: string
  visible: boolean
  enabled?: boolean
  loading?: boolean
  onClick: () => void
}

export function useMainButton({ text, visible, enabled = true, loading = false, onClick }: MainButtonConfig) {
  // Visual state.
  useEffect(() => {
    const mb = webApp()?.MainButton
    if (!mb) return
    mb.setText?.(text)
    if (loading) mb.showProgress?.(false)
    else mb.hideProgress?.()
    if (enabled && !loading) mb.enable?.()
    else mb.disable?.()
    if (visible) mb.show?.()
    else mb.hide?.()
  }, [text, visible, enabled, loading])

  // Click handler (kept in its own effect so a new closure each render doesn't
  // thrash the visual state above).
  useEffect(() => {
    const mb = webApp()?.MainButton
    if (!mb) return
    mb.onClick?.(onClick)
    return () => mb.offClick?.(onClick)
  }, [onClick])

  // Always hide when the owning screen unmounts.
  useEffect(() => () => { webApp()?.MainButton?.hide?.() }, [])
}

// ---------------------------------------------------------------------------
// Stars invoice — opens Telegram's native Stars payment sheet.
// ---------------------------------------------------------------------------
/** Opens Telegram's native Stars invoice sheet. Resolves with the final status. */
export function openInvoice(url: string): Promise<'paid' | 'cancelled' | 'failed' | 'pending'> {
  return new Promise((resolve) => {
    const wa = webApp()
    if (!wa?.openInvoice) return resolve('failed')
    try {
      wa.openInvoice(url, (status) => resolve(status))
    } catch {
      resolve('failed')
    }
  })
}
