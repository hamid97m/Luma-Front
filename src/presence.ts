import { create } from 'zustand'
import { subscribe, useRealtimeStore } from './realtime.js'
import { useAuthStore } from './store.js'
import type { Match } from './types.js'

// Who's online right now, per user. Seeded from every matches list load
// (`match.user.online`) and kept current by the live stream's `presence`
// events. Presence is only trustworthy while the stream is up: on disconnect
// everything is forgotten, and nobody shows online until the next list load
// or presence event after reconnecting.

interface PresenceState {
  /** userId → online. */
  byUser: Record<string, boolean>
}

export const usePresenceStore = create<PresenceState>(() => ({ byUser: {} }))

/** Overwrite presence for every counterpart in a freshly loaded matches list. */
export function seedPresence(matches: Match[]): void {
  if (matches.length === 0) return
  usePresenceStore.setState((s) => {
    const byUser = { ...s.byUser }
    for (const m of matches) byUser[m.user.id] = m.user.online === true
    return { byUser }
  })
}

/** Set one user's presence. */
export function setPresence(userId: string, online: boolean): void {
  if (usePresenceStore.getState().byUser[userId] === online) return
  usePresenceStore.setState((s) => ({ byUser: { ...s.byUser, [userId]: online } }))
}

/** Forget everything (disconnect, tests). */
export function resetPresence(): void {
  usePresenceStore.setState({ byUser: {} })
}

/** Is `userId` online right now? Never true for me, nor while the stream is down. */
export function useIsOnline(userId: string | null | undefined): boolean {
  const connected = useRealtimeStore((s) => s.connected)
  const me = useAuthStore((s) => s.user?.id)
  const online = usePresenceStore((s) => (userId ? s.byUser[userId] === true : false))
  return connected && online && !!userId && userId !== me
}

subscribe((ev) => {
  if (ev.type === 'presence') setPresence(ev.userId, ev.online)
})

useRealtimeStore.subscribe((s, prev) => {
  if (prev.connected && !s.connected) resetPresence()
})
