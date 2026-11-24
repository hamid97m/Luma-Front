import type { LocalMessage, UserProfile } from '../types.js'

/** Matches created before this keep working without the limit. */
export const REPLY_LIMIT_SINCE = '2026-11-25T00:00:00Z'

/** `notice`: he may send his one message. `locked`: sent, now waiting for a reply. */
export type ReplyLimit = 'none' | 'notice' | 'locked'

interface Input {
  viewerGender: UserProfile['gender'] | null | undefined
  /** When the match was created (`Match.matchedAt`). */
  matchedAt: string
  /** The whole history was fetched — without it a reply could be missing. */
  historyLoaded: boolean
  messages: readonly Pick<LocalMessage, 'senderId' | 'type' | 'status'>[]
  myUserId: string
}

/**
 * Men send one message per new match, then wait for a reply. Anything the other
 * person sent (a gift too) except the auto-posted icebreaker is a reply. Only
 * his texts use up the one message — not gifts, icebreakers or failed sends.
 */
export function replyLimit({ viewerGender, matchedAt, historyLoaded, messages, myUserId }: Input): ReplyLimit {
  if (viewerGender !== 'man' || !historyLoaded) return 'none'
  if (!(Date.parse(matchedAt) >= Date.parse(REPLY_LIMIT_SINCE))) return 'none' // older, or unknown
  if (messages.some((m) => m.senderId !== myUserId && m.type !== 'icebreaker')) return 'none'
  const sent = messages.some((m) => m.senderId === myUserId && m.type === 'text' && m.status !== 'failed')
  return sent ? 'locked' : 'notice'
}
