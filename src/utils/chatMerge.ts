import type { LocalMessage, Message } from '../types.js'

// Pure merge helpers for the open chat. A message the user sends exists first
// as an optimistic `local-N` bubble; its server copy can then arrive two ways,
// in either order: the POST response and the live `message` event. These
// helpers make both paths converge on exactly one bubble.

function time(m: Message): number {
  const t = Date.parse(m.createdAt)
  return Number.isNaN(t) ? 0 : t
}

/** Insert a server message keeping chronological order (usually an append). */
function insertSorted(list: LocalMessage[], msg: Message): LocalMessage[] {
  let at = list.length
  while (at > 0 && time(list[at - 1]) > time(msg)) at--
  return [...list.slice(0, at), msg, ...list.slice(at)]
}

/** Index of the optimistic bubble a server copy of my own message stands for. */
function findOptimistic(list: LocalMessage[], msg: Message): number {
  const matches = (m: LocalMessage, status: LocalMessage['status']) =>
    m.status === status
    && m.id.startsWith('local-')
    && m.body === msg.body
    && (m.replyToMessageId ?? null) === (msg.replyToMessageId ?? null)
  const sending = list.findIndex((m) => matches(m, 'sending'))
  return sending !== -1 ? sending : list.findIndex((m) => matches(m, 'failed'))
}

/**
 * A server message arrived (live event or incremental refresh).
 * Known id → replace in place. My own text message matching a pending
 * optimistic bubble → that bubble becomes the server copy (so the later POST
 * response finds it by id and drops its local copy). Otherwise → insert.
 */
export function mergeIncoming(list: LocalMessage[], msg: Message, myUserId: string): LocalMessage[] {
  const known = list.findIndex((m) => m.id === msg.id)
  if (known !== -1) return list.map((m, i) => (i === known ? msg : m))
  if (msg.senderId === myUserId && msg.type === 'text') {
    const local = findOptimistic(list, msg)
    if (local !== -1) return list.map((m, i) => (i === local ? msg : m))
  }
  return insertSorted(list, msg)
}

/**
 * The POST for optimistic bubble `localId` succeeded with `msg`.
 * Already merged via the live event → drop the local bubble (if still there).
 * Otherwise the local bubble becomes `msg`; if a live event for a different
 * identical send already took that bubble, insert `msg` on its own.
 */
export function mergeSent(list: LocalMessage[], localId: string, msg: Message): LocalMessage[] {
  if (list.some((m) => m.id === msg.id)) return list.filter((m) => m.id !== localId)
  if (list.some((m) => m.id === localId)) return list.map((m) => (m.id === localId ? msg : m))
  return insertSorted(list, msg)
}

/** `message_updated` (edit or read receipt) → replace in place; unknown ids are ignored. */
export function mergeUpdated(list: LocalMessage[], msg: Message): LocalMessage[] {
  return list.some((m) => m.id === msg.id) ? list.map((m) => (m.id === msg.id ? msg : m)) : list
}

/** Newest message the server has confirmed — the `?after=` cursor. */
export function lastServerId(list: LocalMessage[]): string | null {
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i]
    if (!m.status && !m.id.startsWith('local-')) return m.id
  }
  return null
}

/**
 * Full refresh: the server list wins, except bubbles with a client-side
 * status (sending/failed/edit in flight) are kept. A pending optimistic bubble
 * whose server copy is already in the list (new since `prev`, mine, same text)
 * is dropped instead of being shown twice.
 */
export function mergeFullList(prev: LocalMessage[], server: Message[], myUserId: string): LocalMessage[] {
  const unconfirmed = prev.filter((m) => m.status)
  const byId = new Map(unconfirmed.map((m) => [m.id, m]))
  const merged: LocalMessage[] = server.map((m) => byId.get(m.id) ?? m)
  const serverIds = new Set(server.map((m) => m.id))
  const prevIds = new Set(prev.map((m) => m.id))
  const claimable = server.filter((s) => !prevIds.has(s.id) && s.senderId === myUserId && s.type === 'text')
  const extras = unconfirmed.filter((m) => {
    if (serverIds.has(m.id)) return false
    if (!m.id.startsWith('local-')) return true
    const i = claimable.findIndex((s) => s.body === m.body && (s.replyToMessageId ?? null) === (m.replyToMessageId ?? null))
    if (i === -1) return true
    claimable.splice(i, 1)
    return false
  })
  return [...merged, ...extras]
}
