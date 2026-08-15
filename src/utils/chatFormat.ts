import { t } from '../i18n.js'
import { formatShortDate, formatTime as formatTimeFa } from '../i18n/format.js'
import type { LocalMessage } from '../types.js'

const GROUP_WINDOW_MS = 5 * 60 * 1000

export type ChatItem =
  | { kind: 'date'; id: string; label: string }
  | { kind: 'message'; message: LocalMessage; first: boolean; last: boolean }

export function formatTime(iso: string): string {
  return formatTimeFa(new Date(iso))
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function formatDayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (sameDay(d, now)) return t.time.today
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, yesterday)) return t.time.yesterday
  return formatShortDate(d)
}

function grouped(a: LocalMessage, b: LocalMessage): boolean {
  return (
    a.senderId === b.senderId &&
    sameDay(new Date(a.createdAt), new Date(b.createdAt)) &&
    Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) <= GROUP_WINDOW_MS
  )
}

/** Shapes raw messages into renderable items: date chips + messages with group-position flags. */
export function buildChatItems(messages: LocalMessage[], now: Date = new Date()): ChatItem[] {
  const items: ChatItem[] = []
  messages.forEach((m, i) => {
    const prev = messages[i - 1]
    const next = messages[i + 1]
    if (!prev || !sameDay(new Date(prev.createdAt), new Date(m.createdAt))) {
      items.push({ kind: 'date', id: `date-${m.id}`, label: formatDayLabel(m.createdAt, now) })
    }
    items.push({
      kind: 'message',
      message: m,
      first: !prev || !grouped(prev, m),
      last: !next || !grouped(m, next),
    })
  })
  return items
}
