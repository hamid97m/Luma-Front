// Shared helpers for the "ask a friend" feature: copy lookups, analytics,
// feature-config store, error parsing and the ask-link launch param.
import { create } from 'zustand'
import { api, type AskEventInput } from '../../api.js'
import { t } from '../../i18n.js'
import type { AskQuestion, AskVerdict } from '../../types.js'

export const ASK_QUESTIONS: readonly AskQuestion[] = ['reply', 'date', 'red_flag']
export const ASK_VERDICTS: readonly AskVerdict[] = ['yes', 'unsure', 'no']
export const ASK_MAX_RECIPIENTS = 3
export const ASK_NOTE_MAX = 300

export const questionLabel = (q: AskQuestion): string => t.ask.questions[q] ?? t.ask.questions.reply
export const verdictLabel = (q: AskQuestion, v: AskVerdict): string => (t.ask.verdicts[q] ?? t.ask.verdicts.reply)[v]

/** Error body of a failed request() — `{ error, ...extra }` JSON when parseable. */
export function errorBody(err: unknown): { status?: number; error?: string; [k: string]: unknown } {
  const status = (err as { status?: number } | null)?.status
  const message = err instanceof Error ? err.message : ''
  try {
    const parsed = JSON.parse(message) as Record<string, unknown>
    return { status, ...parsed, error: typeof parsed.error === 'string' ? parsed.error : message }
  } catch {
    return { status, error: message }
  }
}

/** Fire-and-forget analytics; never throws, never blocks UI. */
export function trackAsk(input: AskEventInput): void {
  try {
    void Promise.resolve(api.asks.event(input)).catch(() => {})
  } catch { /* api unavailable */ }
}

/** Same, for the public ask-link flow (works before any users row exists). */
export function trackAskLink(token: string, input: AskEventInput): void {
  try {
    void Promise.resolve(api.asks.linkEvent(token, input)).catch(() => {})
  } catch { /* api unavailable */ }
}

/** Ask-link launch: `startapp=ask_<token>`, or the bot reminder's
 *  `?screen=ask_link&r=<recipientId>` (token `r_<id>`, which skips the
 *  anonymous landing and resolves with initData straight away). */
export function readAskLaunch(): { token: string; skipLanding: boolean } | null {
  const token = readAskStartToken()
  if (token) return { token, skipLanding: false }
  try {
    const q = new URLSearchParams(window.location.search)
    const r = q.get('r')
    if (q.get('screen') === 'ask_link' && r) return { token: `r_${r}`, skipLanding: true }
  } catch { /* no URL */ }
  return null
}

/** `startapp=ask_<token>` launch → the token, else null. */
export function readAskStartToken(): string | null {
  const sp = window.Telegram?.WebApp?.initDataUnsafe?.start_param
  if (!sp || !sp.startsWith('ask_')) return null
  const token = sp.slice(4)
  return token.length > 0 ? token : null
}

// GET /asks/config → whether the entry button shows for this user.
interface AskConfigState {
  enabled: boolean
  refresh: () => Promise<void>
}

export const useAskConfigStore = create<AskConfigState>((set) => ({
  enabled: false,
  refresh: async () => {
    try {
      const { enabled } = await api.asks.config()
      set({ enabled: !!enabled })
    } catch {
      /* keep last known (default off) */
    }
  },
}))

// First-time tooltip (F11) — once per Telegram account on this device.
const TOOLTIP_KEY = 'luma_ask_tooltip_seen'
const tooltipKey = () => `${TOOLTIP_KEY}:${window.Telegram?.WebApp?.initDataUnsafe?.user?.id ?? 'web'}`

export function askTooltipSeen(): boolean {
  try {
    return localStorage.getItem(tooltipKey()) === '1'
  } catch {
    return true
  }
}

export function markAskTooltipSeen(): void {
  try {
    localStorage.setItem(tooltipKey(), '1')
  } catch { /* not persisted */ }
}

/** Copy to clipboard; resolves true on success. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand?.('copy') ?? false
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function shareUrl(link: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
}

export function showToast(message: string): void {
  const alert = window.Telegram?.WebApp?.showAlert
  if (alert) {
    try { alert(message); return } catch { /* fall through */ }
  }
}

// A decision made on the app-level results screen (bot DM deep link), handed
// to Discovery so its queue/swipedIds stay the single source of truth:
// 'reply' brings that card to the top, 'pass' swipes it away. Discovery
// clears it as soon as it has applied it against its current batch.
export interface AskDecision {
  targetId: string
  decision: 'reply' | 'pass'
}

interface AskDecisionState {
  pending: AskDecision | null
  request: (d: AskDecision) => void
  clear: () => void
}

export const useAskDecisionStore = create<AskDecisionState>((set) => ({
  pending: null,
  request: (pending) => set({ pending }),
  clear: () => set({ pending: null }),
}))
