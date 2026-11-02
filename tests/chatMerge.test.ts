import { describe, it, expect } from 'vitest'
import { lastServerId, mergeFullList, mergeIncoming, mergeSent, mergeUpdated } from '../src/utils/chatMerge.js'
import type { LocalMessage, Message } from '../src/types.js'

const ME = 'me-1'
const msg = (id: string, body: string, at: string, senderId = ME): Message =>
  ({ id, senderId, body, createdAt: `2026-01-01T10:${at}Z`, readAt: null, type: 'text', replyToMessageId: null })
const local = (id: string, body: string, at: string, status: 'sending' | 'failed' = 'sending'): LocalMessage =>
  ({ ...msg(id, body, at), status })

const ids = (l: LocalMessage[]) => l.map((m) => m.id)

describe('chat merge — optimistic send vs live event', () => {
  const base = [msg('a', 'old', '00:00')]

  it('POST response first, then the live event → one bubble', () => {
    let l: LocalMessage[] = [...base, local('local-1', 'hi', '01:00')]
    l = mergeSent(l, 'local-1', msg('s1', 'hi', '01:00'))
    l = mergeIncoming(l, msg('s1', 'hi', '01:00'), ME)
    expect(ids(l)).toEqual(['a', 's1'])
    expect(l[1].status).toBeUndefined()
  })

  it('live event first, then the POST response → one bubble', () => {
    let l: LocalMessage[] = [...base, local('local-1', 'hi', '01:00')]
    l = mergeIncoming(l, msg('s1', 'hi', '01:00'), ME)
    expect(ids(l)).toEqual(['a', 's1'])
    l = mergeSent(l, 'local-1', msg('s1', 'hi', '01:00'))
    expect(ids(l)).toEqual(['a', 's1'])
  })

  it('two identical sends whose events cross still end with two bubbles', () => {
    let l: LocalMessage[] = [local('local-1', 'hi', '01:00'), local('local-2', 'hi', '01:01')]
    l = mergeIncoming(l, msg('s2', 'hi', '01:01'), ME) // takes local-1's bubble
    l = mergeSent(l, 'local-1', msg('s1', 'hi', '01:00')) // its bubble is gone → inserted
    l = mergeIncoming(l, msg('s1', 'hi', '01:00'), ME)
    l = mergeSent(l, 'local-2', msg('s2', 'hi', '01:01'))
    expect(ids(l).sort()).toEqual(['s1', 's2'])
  })

  it('a failed POST after the live event changes nothing (the bubble is the server copy)', () => {
    let l: LocalMessage[] = [local('local-1', 'hi', '01:00')]
    l = mergeIncoming(l, msg('s1', 'hi', '01:00'), ME)
    // Chat's catch handler maps local-1 → failed; it no longer exists.
    l = l.map((m) => (m.id === 'local-1' ? { ...m, status: 'failed' as const } : m))
    expect(l).toEqual([msg('s1', 'hi', '01:00')])
  })

  it('does not claim an optimistic bubble with a different body or for their message', () => {
    let l: LocalMessage[] = [local('local-1', 'hi', '01:00')]
    l = mergeIncoming(l, msg('s9', 'other', '01:00'), ME)
    l = mergeIncoming(l, msg('t1', 'hi', '01:00', 'other-1'), ME)
    expect(ids(l)).toEqual(['local-1', 's9', 't1'])
  })

  it('inserts an older message in chronological order and replaces known ids', () => {
    let l: LocalMessage[] = [msg('a', 'x', '00:00'), msg('c', 'z', '02:00')]
    l = mergeIncoming(l, msg('b', 'y', '01:00', 'other-1'), ME)
    expect(ids(l)).toEqual(['a', 'b', 'c'])
    l = mergeIncoming(l, { ...msg('b', 'y2', '01:00', 'other-1') }, ME)
    expect(l[1].body).toBe('y2')
  })

  it('mergeUpdated replaces in place and ignores unknown ids', () => {
    const l = [msg('a', 'x', '00:00')]
    expect(mergeUpdated(l, { ...msg('a', 'x', '00:00'), readAt: '2026-01-01T11:00:00Z' })[0].readAt).not.toBeNull()
    expect(mergeUpdated(l, msg('zz', 'q', '00:00'))).toBe(l)
  })

  it('mergeFullList drops a pending bubble whose server copy is new in the list', () => {
    const prev: LocalMessage[] = [msg('a', 'x', '00:00'), local('local-1', 'hi', '01:00'), local('local-2', 'later', '01:05')]
    const server = [msg('a', 'x', '00:00'), msg('s1', 'hi', '01:00')]
    expect(ids(mergeFullList(prev, server, ME))).toEqual(['a', 's1', 'local-2'])
  })

  it('lastServerId skips local and in-flight bubbles', () => {
    expect(lastServerId([msg('a', 'x', '00:00'), local('local-1', 'hi', '01:00')])).toBe('a')
    expect(lastServerId([local('local-1', 'hi', '01:00')])).toBeNull()
  })
})
