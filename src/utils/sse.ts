/** One dispatched Server-Sent Event. `event` defaults to 'message' per the spec. */
export interface SseEvent {
  event: string
  data: string
}

/**
 * Incremental text/event-stream parser (WHATWG "event stream interpretation").
 * Feed it decoded text chunks as they arrive — a chunk may end mid-line or
 * between the CR and LF of a CRLF — and it returns the events completed by
 * that chunk. Comment lines (`: ping`) are ignored; multi-line `data:` fields
 * are joined with '\n'; an event with no data is not dispatched.
 */
export class SseParser {
  private buf = ''
  private eventName = ''
  private data: string[] = []
  private started = false
  private skipLF = false

  push(chunk: string): SseEvent[] {
    if (!this.started && chunk.length > 0) {
      this.started = true
      if (chunk.charCodeAt(0) === 0xfeff) chunk = chunk.slice(1)
    }
    // The previous chunk ended in CR: a leading LF here is the rest of that CRLF.
    if (this.skipLF && chunk.length > 0) {
      if (chunk[0] === '\n') chunk = chunk.slice(1)
      this.skipLF = false
    }
    this.buf += chunk
    const out: SseEvent[] = []
    let start = 0
    for (let i = 0; i < this.buf.length; i++) {
      const c = this.buf[i]
      if (c !== '\n' && c !== '\r') continue
      this.line(this.buf.slice(start, i), out)
      if (c === '\r') {
        if (i === this.buf.length - 1) this.skipLF = true // CRLF may be split across chunks
        else if (this.buf[i + 1] === '\n') i++
      }
      start = i + 1
    }
    this.buf = this.buf.slice(start)
    return out
  }

  private line(line: string, out: SseEvent[]): void {
    if (line === '') {
      if (this.data.length > 0) out.push({ event: this.eventName || 'message', data: this.data.join('\n') })
      this.eventName = ''
      this.data = []
      return
    }
    if (line[0] === ':') return // comment / heartbeat
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value[0] === ' ') value = value.slice(1)
    if (field === 'event') this.eventName = value
    else if (field === 'data') this.data.push(value)
    // `id` and `retry` are not used — reconnection is managed by the client.
  }
}
