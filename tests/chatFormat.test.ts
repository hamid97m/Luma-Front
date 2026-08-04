import { describe, it, expect } from 'vitest'
import { buildChatItems, formatDayLabel } from '../src/utils/chatFormat.js'
import type { LocalMessage } from '../src/types.js'

const NOW = new Date('2026-08-03T18:00:00')

function msg(id: string, senderId: string, createdAt: string): LocalMessage {
  return { id, senderId, body: `body-${id}`, createdAt, readAt: null, type: 'text' }
}

describe('formatDayLabel', () => {
  it('labels the current day "Today"', () => {
    expect(formatDayLabel('2026-08-03T09:00:00', NOW)).toBe('Today')
  })

  it('labels the previous day "Yesterday"', () => {
    expect(formatDayLabel('2026-08-02T23:59:00', NOW)).toBe('Yesterday')
  })

  it('labels older days with a short date', () => {
    expect(formatDayLabel('2026-07-30T10:00:00', NOW)).toMatch(/Jul(y)? 30/)
  })
})

describe('buildChatItems', () => {
  it('inserts a date chip before the first message and on each day change', () => {
    const items = buildChatItems([
      msg('m1', 'a', '2026-08-02T10:00:00'),
      msg('m2', 'a', '2026-08-03T10:00:00'),
    ], NOW)

    expect(items.map((i) => i.kind)).toEqual(['date', 'message', 'date', 'message'])
    expect(items[0]).toMatchObject({ kind: 'date', label: 'Yesterday' })
    expect(items[2]).toMatchObject({ kind: 'date', label: 'Today' })
  })

  it('groups consecutive same-sender messages within 5 minutes', () => {
    const items = buildChatItems([
      msg('m1', 'a', '2026-08-03T10:00:00'),
      msg('m2', 'a', '2026-08-03T10:02:00'),
      msg('m3', 'a', '2026-08-03T10:04:00'),
    ], NOW)

    const flags = items.filter((i) => i.kind === 'message')
    expect(flags[0]).toMatchObject({ first: true, last: false })
    expect(flags[1]).toMatchObject({ first: false, last: false })
    expect(flags[2]).toMatchObject({ first: false, last: true })
  })

  it('breaks the group when the sender changes', () => {
    const items = buildChatItems([
      msg('m1', 'a', '2026-08-03T10:00:00'),
      msg('m2', 'b', '2026-08-03T10:01:00'),
    ], NOW)

    const flags = items.filter((i) => i.kind === 'message')
    expect(flags[0]).toMatchObject({ first: true, last: true })
    expect(flags[1]).toMatchObject({ first: true, last: true })
  })

  it('breaks the group when messages are more than 5 minutes apart', () => {
    const items = buildChatItems([
      msg('m1', 'a', '2026-08-03T10:00:00'),
      msg('m2', 'a', '2026-08-03T10:06:00'),
    ], NOW)

    const flags = items.filter((i) => i.kind === 'message')
    expect(flags[0]).toMatchObject({ first: true, last: true })
    expect(flags[1]).toMatchObject({ first: true, last: true })
  })
})
