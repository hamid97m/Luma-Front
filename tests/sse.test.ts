import { describe, it, expect } from 'vitest'
import { SseParser } from '../src/utils/sse.js'

function feed(chunks: string[]) {
  const p = new SseParser()
  return chunks.flatMap((c) => p.push(c))
}

describe('SseParser', () => {
  it('parses named events with JSON data', () => {
    expect(feed(['retry: 3000\n\nevent: ready\ndata: {}\n\n'])).toEqual([{ event: 'ready', data: '{}' }])
  })

  it('defaults the event name to "message" and ignores comments', () => {
    expect(feed([': ping\n\n', 'data: x\n\n', ':another comment\n'])).toEqual([{ event: 'message', data: 'x' }])
  })

  it('joins multi-line data with newlines', () => {
    expect(feed(['event: a\ndata: one\ndata:two\ndata:  three\n\n'])).toEqual([
      { event: 'a', data: 'one\ntwo\n three' },
    ])
  })

  it('handles CRLF and lone CR line endings', () => {
    expect(feed(['event: a\r\ndata: 1\r\n\r\n', 'event: b\rdata: 2\r\r'])).toEqual([
      { event: 'a', data: '1' },
      { event: 'b', data: '2' },
    ])
  })

  it('reassembles events split mid-line and mid-CRLF across chunks', () => {
    const text = 'event: message\r\ndata: {"matchId":"m1","message":{"id":"x","body":"سلام"}}\r\n\r\n: ping\r\n\r\n'
    // Every possible single split point, including between \r and \n.
    for (let i = 1; i < text.length; i++) {
      expect(feed([text.slice(0, i), text.slice(i)])).toEqual([
        { event: 'message', data: '{"matchId":"m1","message":{"id":"x","body":"سلام"}}' },
      ])
    }
    // One character at a time, with empty chunks in between (a TextDecoder
    // returns '' while it holds a partial multi-byte character).
    expect(feed([...text].flatMap((c) => [c, '']))).toHaveLength(1)
  })

  it('does not dispatch an event without data, and resets the name after dispatch', () => {
    expect(feed(['event: lonely\n\n', 'data: y\n\n'])).toEqual([{ event: 'message', data: 'y' }])
  })

  it('waits for the blank line before dispatching', () => {
    const p = new SseParser()
    expect(p.push('event: a\ndata: 1\n')).toEqual([])
    expect(p.push('\n')).toEqual([{ event: 'a', data: '1' }])
  })

  it('strips a leading BOM and treats a field without colon as empty value', () => {
    expect(feed(['﻿data\n\n', 'data: z\n\n'])).toEqual([
      { event: 'message', data: '' },
      { event: 'message', data: 'z' },
    ])
  })
})
