/**
 * Leading-edge throttle: the first call runs `fn` right away, further calls
 * within `intervalMs` are dropped. `reset()` lets the next call through.
 */
export function leadingThrottle(fn: () => void, intervalMs: number, now: () => number = Date.now) {
  let last = -Infinity
  return {
    call(): void {
      const t = now()
      if (t - last < intervalMs) return
      last = t
      fn()
    },
    reset(): void {
      last = -Infinity
    },
  }
}
