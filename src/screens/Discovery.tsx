import { useState, useEffect, useCallback } from 'react'
import { t } from '../i18n.js'
import { api } from '../api.js'
import { CardStack } from '../components/CardStack.js'
import { MatchPopup } from '../components/MatchPopup.js'
import type { DiscoveryProfile, SwipeResult } from '../types.js'

const PREFETCH_THRESHOLD = 2

interface Props {
  onMatch: (result: NonNullable<SwipeResult['match']>) => void
}

export function Discovery({ onMatch }: Props) {
  const [queue, setQueue] = useState<DiscoveryProfile[]>([])
  const [exhausted, setExhausted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [swiping, setSwiping] = useState(false)
  const [activeMatch, setActiveMatch] = useState<NonNullable<SwipeResult['match']> | null>(null)

  const fetchBatch = useCallback(async () => {
    const { profiles, exhausted: done } = await api.discovery.feed()
    setQueue((q) => [...q, ...profiles])
    setExhausted(done)
    setLoading(false)
  }, [])

  useEffect(() => { fetchBatch() }, [fetchBatch])

  const swipe = async (direction: 'like' | 'pass') => {
    const [current, ...rest] = queue
    if (!current || swiping) return

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
    return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-4xl">💘</div></div>
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
