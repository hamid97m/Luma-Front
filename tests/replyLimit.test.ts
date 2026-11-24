import { describe, it, expect } from 'vitest'
import { replyLimit, REPLY_LIMIT_SINCE } from '../src/utils/replyLimit.js'
import type { LocalMessage } from '../src/types.js'

type Msg = Pick<LocalMessage, 'senderId' | 'type' | 'status'>
const mine = (type: Msg['type'] = 'text', status?: Msg['status']): Msg => ({ senderId: 'me', type, status })
const theirs = (type: Msg['type'] = 'text'): Msg => ({ senderId: 'her', type })
const decide = (messages: Msg[], over: Partial<Parameters<typeof replyLimit>[0]> = {}) =>
  replyLimit({ viewerGender: 'man', matchedAt: '2027-01-01T00:00:00Z', historyLoaded: true, messages, myUserId: 'me', ...over })

describe('replyLimit', () => {
  it.each<[string, Msg[], string]>([
    ['empty chat', [], 'notice'],
    ['icebreakers only', [mine('icebreaker'), theirs('icebreaker')], 'notice'],
    ['one sent', [mine()], 'locked'],
    ['one still sending', [mine('text', 'sending')], 'locked'],
    ['accepted-request opener after icebreakers', [theirs('icebreaker'), mine('icebreaker'), mine()], 'locked'],
    ['reply received', [mine(), theirs()], 'none'],
    ['they wrote first', [theirs()], 'none'],
    ['gift received as a reply', [mine(), theirs('gift')], 'none'],
    ['their icebreaker is not a reply', [mine(), theirs('icebreaker')], 'locked'],
    ['failed send', [mine('text', 'failed')], 'notice'],
    ['failed send beside a delivered one', [mine('text', 'failed'), mine()], 'locked'],
    ['a gift from him leaves his one message', [mine('gift')], 'notice'],
  ])('%s → %s', (_name, messages, expected) => {
    expect(decide(messages as Msg[])).toBe(expected)
  })

  it('history not loaded → no limit', () => {
    expect(decide([mine()], { historyLoaded: false })).toBe('none')
    expect(decide([], { historyLoaded: false })).toBe('none')
  })

  it('old match → no limit; the release moment itself is new', () => {
    const before = new Date(Date.parse(REPLY_LIMIT_SINCE) - 1).toISOString()
    expect(decide([mine()], { matchedAt: before })).toBe('none')
    expect(decide([], { matchedAt: before })).toBe('none')
    expect(decide([mine()], { matchedAt: REPLY_LIMIT_SINCE })).toBe('locked')
    expect(decide([mine()], { matchedAt: '' })).toBe('none')
  })

  it.each(['woman', 'nonbinary', null, undefined] as const)('viewer %s → no limit', (viewerGender) => {
    expect(decide([mine(), mine()], { viewerGender })).toBe('none')
    expect(decide([], { viewerGender })).toBe('none')
  })
})
