import { create } from 'zustand'
import { SseParser, type SseEvent } from './utils/sse.js'
import type { Message } from './types.js'

// Live chat updates over one Server-Sent Events stream per user (GET /events).
// EventSource can't send the Authorization header, so the stream is read with
// fetch() + a streaming body — supported by Telegram's iOS/Android WebViews.
// The stream is open only while the app is in the foreground.

const BASE = import.meta.env.VITE_API_URL as string

const BACKOFF_MIN_MS = 1_000
const BACKOFF_MAX_MS = 30_000
/** A stream that stayed up this long counts as healthy — backoff resets. */
const HEALTHY_MS = 10_000
/** The server pings every 25 s; silence this long means the stream is dead. */
const WATCHDOG_MS = 60_000

export type RealtimeEvent =
  /** Stream (re)opened or the server lost events — refetch what's on screen. */
  | { type: 'sync' }
  | { type: 'message'; matchId: string; message: Message }
  | { type: 'message_updated'; matchId: string; message: Message }
  | { type: 'message_deleted'; matchId: string; messageId: string }
  /** The other participant is typing in this chat (ephemeral, never stored). */
  | { type: 'typing'; matchId: string; userId: string }
  /** A counterpart came online or went offline (offline is debounced server-side). */
  | { type: 'presence'; userId: string; online: boolean }

type Handler = (event: RealtimeEvent) => void

interface RealtimeState {
  connected: boolean
}

export const useRealtimeStore = create<RealtimeState>(() => ({ connected: false }))

const handlers = new Set<Handler>()

/** Listen to live events. Returns an unsubscribe. */
export function subscribe(handler: Handler): () => void {
  handlers.add(handler)
  return () => { handlers.delete(handler) }
}

/** Deliver an event to every subscriber. Exported for tests. */
export function dispatch(event: RealtimeEvent): void {
  for (const h of [...handlers]) {
    try {
      h(event)
    } catch (err) {
      console.error('realtime handler failed', err)
    }
  }
}

/** Map a raw SSE event to a RealtimeEvent; unknown/garbled events → null. */
export function toRealtimeEvent(sse: SseEvent): RealtimeEvent | null {
  if (sse.event === 'ready' || sse.event === 'resync') return { type: 'sync' }
  let data: Record<string, unknown>
  try {
    data = JSON.parse(sse.data) as Record<string, unknown>
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  if (sse.event === 'presence') {
    return typeof data.userId === 'string' && typeof data.online === 'boolean'
      ? { type: 'presence', userId: data.userId, online: data.online }
      : null
  }
  if (typeof data.matchId !== 'string') return null
  const matchId = data.matchId
  switch (sse.event) {
    case 'message':
    case 'message_updated': {
      const message = data.message as Message | undefined
      if (!message || typeof message.id !== 'string') return null
      return { type: sse.event, matchId, message }
    }
    case 'message_deleted':
      return typeof data.messageId === 'string' ? { type: 'message_deleted', matchId, messageId: data.messageId } : null
    case 'typing':
      return typeof data.userId === 'string' ? { type: 'typing', matchId, userId: data.userId } : null
    default:
      return null
  }
}

// ── Connection manager ────────────────────────────────────────────────────

let running = false
/** 401/403 — don't hammer; try again only on the next return to foreground. */
let authStopped = false
let controller: AbortController | null = null
let generation = 0
let backoff = BACKOFF_MIN_MS
let retryTimer: ReturnType<typeof setTimeout> | null = null
let watchdogTimer: ReturnType<typeof setTimeout> | null = null

function isVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

function setConnected(connected: boolean): void {
  if (useRealtimeStore.getState().connected !== connected) useRealtimeStore.setState({ connected })
}

function clearRetry(): void {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
}

function clearWatchdog(): void {
  if (watchdogTimer) clearTimeout(watchdogTimer)
  watchdogTimer = null
}

/** Drop the current stream (if any) without scheduling a reconnect. */
function teardown(): void {
  generation++
  clearWatchdog()
  controller?.abort()
  controller = null
  setConnected(false)
}

function scheduleReconnect(): void {
  clearRetry()
  if (!running || authStopped || !isVisible()) return
  const delay = backoff + Math.random() * backoff * 0.3
  backoff = Math.min(backoff * 2, BACKOFF_MAX_MS)
  retryTimer = setTimeout(() => { retryTimer = null; void connect() }, delay)
}

async function connect(): Promise<void> {
  if (!running || authStopped || controller || !isVisible()) return
  clearRetry()
  const gen = ++generation
  const ctrl = new AbortController()
  controller = ctrl
  let openedAt = 0

  const armWatchdog = () => {
    clearWatchdog()
    watchdogTimer = setTimeout(() => ctrl.abort(), WATCHDOG_MS)
  }
  armWatchdog()

  try {
    const res = await fetch(`${BASE}/events`, {
      headers: {
        Authorization: window.Telegram?.WebApp?.initData ?? '',
        Accept: 'text/event-stream',
      },
      cache: 'no-store',
      signal: ctrl.signal,
    })
    if (res.status === 401 || res.status === 403) {
      authStopped = true
      return
    }
    if (!res.ok || !res.body) throw new Error(`events ${res.status}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const parser = new SseParser()
    for (;;) {
      const { done, value } = await reader.read()
      if (gen !== generation) return
      if (done) break
      armWatchdog()
      for (const sse of parser.push(decoder.decode(value, { stream: true }))) {
        if (sse.event === 'ready') {
          openedAt = Date.now()
          setConnected(true)
        }
        const ev = toRealtimeEvent(sse)
        if (ev) dispatch(ev)
      }
    }
  } catch {
    // network error, watchdog abort, or our own teardown — handled below
  } finally {
    if (gen === generation) {
      // This stream ended on its own (not torn down by stop/hidden).
      clearWatchdog()
      controller = null
      setConnected(false)
      if (openedAt && Date.now() - openedAt >= HEALTHY_MS) backoff = BACKOFF_MIN_MS
      scheduleReconnect()
    }
  }
}

function onVisibilityChange(): void {
  if (isVisible()) {
    authStopped = false
    backoff = BACKOFF_MIN_MS
    void connect()
  } else {
    clearRetry()
    teardown()
  }
}

function onOnline(): void {
  if (controller) return
  backoff = BACKOFF_MIN_MS
  void connect()
}

/** Open the stream (idempotent). Called by App once the user is in the main app. */
export function startRealtime(): void {
  if (running) return
  running = true
  authStopped = false
  backoff = BACKOFF_MIN_MS
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('online', onOnline)
  void connect()
}

/** Close the stream and stop reconnecting. */
export function stopRealtime(): void {
  if (!running) return
  running = false
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('online', onOnline)
  clearRetry()
  teardown()
}
