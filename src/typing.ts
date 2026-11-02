import { create } from 'zustand'
import { subscribe } from './realtime.js'

// "typing…" state per chat, fed by the live stream's `typing` events. The
// sender pings at most every few seconds while editing, so an entry lives a
// little longer than that and is dropped as soon as their message arrives.

/** How long one `typing` event keeps the indicator on. */
export const TYPING_TTL_MS = 6_000

interface TypingState {
  /** matchId → id of the user typing there. */
  byMatch: Record<string, string>
}

export const useTypingStore = create<TypingState>(() => ({ byMatch: {} }))

const timers = new Map<string, ReturnType<typeof setTimeout>>()

function clearTimer(matchId: string): void {
  const timer = timers.get(matchId)
  if (timer) clearTimeout(timer)
  timers.delete(matchId)
}

/** Show `userId` as typing in `matchId` for the next TYPING_TTL_MS. */
export function markTyping(matchId: string, userId: string): void {
  clearTimer(matchId)
  timers.set(matchId, setTimeout(() => clearTyping(matchId), TYPING_TTL_MS))
  if (useTypingStore.getState().byMatch[matchId] !== userId) {
    useTypingStore.setState((s) => ({ byMatch: { ...s.byMatch, [matchId]: userId } }))
  }
}

/** Stop showing typing in `matchId` — only if it's `userId` typing, when given. */
export function clearTyping(matchId: string, userId?: string): void {
  const current = useTypingStore.getState().byMatch[matchId]
  if (current === undefined || (userId !== undefined && current !== userId)) return
  clearTimer(matchId)
  useTypingStore.setState((s) => {
    const byMatch = { ...s.byMatch }
    delete byMatch[matchId]
    return { byMatch }
  })
}

/** Forget everything (tests). */
export function resetTyping(): void {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
  useTypingStore.setState({ byMatch: {} })
}

/** Is the other participant typing in this chat right now? */
export function useIsTyping(matchId: string): boolean {
  return useTypingStore((s) => s.byMatch[matchId] !== undefined)
}

subscribe((ev) => {
  if (ev.type === 'typing') markTyping(ev.matchId, ev.userId)
  else if (ev.type === 'message') clearTyping(ev.matchId, ev.message.senderId)
})
