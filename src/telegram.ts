// Central, version-guarded wrapper around the Telegram WebApp JS SDK
// (loaded via <script> tag as window.Telegram.WebApp).
//
// Every function here safely no-ops when running outside Telegram (browser
// dev, unit tests) or on an older client that lacks a given feature, so the
// rest of the app can call these unconditionally.
import { useEffect } from 'react'

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
// One-time app init — call once on mount.
// ---------------------------------------------------------------------------
export function initTelegram() {
  const wa = webApp()
  if (!wa) return
  wa.ready?.()
  wa.expand?.()

  // Lock vertical swipes so dragging a card can't accidentally minimize the
  // Mini App (Bot API 7.7+).
  if (supports('7.7')) wa.disableVerticalSwipes?.()

  // True fullscreen + safe-area tracking (Bot API 8.0+). Falls back silently
  // to the expanded (non-fullscreen) state on failure or older clients.
  if (supports('8.0')) {
    wa.requestFullscreen?.()
    wa.onEvent?.('safeAreaChanged', writeSafeAreaVars)
    wa.onEvent?.('contentSafeAreaChanged', writeSafeAreaVars)
    wa.onEvent?.('fullscreenChanged', writeSafeAreaVars)
  }
  writeSafeAreaVars()
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
