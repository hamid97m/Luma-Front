import { useState, useEffect, useCallback, useRef } from 'react'
import { t } from '../i18n.js'
import { api } from '../api.js'
import { CardStack } from '../components/CardStack.js'
import { MatchPopup } from '../components/MatchPopup.js'
import type { DiscoveryProfile, SwipeResult } from '../types.js'

const PREFETCH_THRESHOLD = 2

export function Discovery() {
  const [queue, setQueue] = useState<DiscoveryProfile[]>([])
  const [exhausted, setExhausted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [swiping, setSwiping] = useState(false)
  const [activeMatch, setActiveMatch] = useState<NonNullable<SwipeResult['match']> | null>(null)
  // Every id swiped this session — outlives the queue, so a prefetch response
  // started before a swipe (and thus unaware of it) can't re-add that profile.
  const swipedIds = useRef<Set<string>>(new Set())

  const fetchBatch = useCallback(async () => {
    const { profiles, exhausted: done } = await api.discovery.feed()
    setQueue((q) => {
      const seen = new Set(q.map((p) => p.id))
      return [...q, ...profiles.filter((p) => !seen.has(p.id) && !swipedIds.current.has(p.id))]
    })
    setExhausted(done)
    setLoading(false)
  }, [])

  useEffect(() => { fetchBatch() }, [fetchBatch])

  const swipe = async (direction: 'like' | 'pass') => {
    const [current, ...rest] = queue
    if (!current || swiping) return

    swipedIds.current.add(current.id)
    setSwiping(true)
    setQueue(rest)

    const result = await api.swipes.swipe(current.id, direction)
    if (result.matched && result.match) {
      // Small delay so card animation can finish before popup
      setTimeout(() => setActiveMatch(result.match!), 400)
    }

    // Prefetch next batch when queue runs low
    if (rest.length <= PREFETCH_THRESHOLD && !exhausted) fetchBatch()

    setSwiping(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <img src="/luma-icon.png" alt="" className="w-14 h-14 rounded-2xl animate-pulse-heart select-none" />
      </div>
    )
  }

  if (exhausted && queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <div className="text-5xl">🕊️</div>
        <h2 className="text-xl font-bold">{t.discovery.empty}</h2>
        <p className="opacity-60">{t.discovery.emptyHint}</p>
      </div>
    )
  }

  return (
    <>
      <CardStack
        profiles={queue}
        onLike={() => swipe('like')}
        onPass={() => swipe('pass')}
        disabled={swiping}
      />
      {activeMatch && (
        <MatchPopup
          match={activeMatch}
          onClose={() => setActiveMatch(null)}
        />
      )}
    </>
  )
}
