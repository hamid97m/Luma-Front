import { useState, useEffect, useCallback } from 'react'
import { t } from '../i18n.js'
import { api } from '../api.js'
import { ProfileCard } from '../components/ProfileCard.js'
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

  const fetchBatch = useCallback(async () => {
    const { profiles, exhausted: done } = await api.discovery.feed()
    setQueue((q) => [...q, ...profiles])
    setExhausted(done && profiles.length === 0)
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
      setTimeout(() => onMatch(result.match!), 400)
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
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Card area */}
      <div className="relative flex-1">
        {queue.slice(0, 2).map((profile, i) => (
          <ProfileCard key={profile.id} profile={profile} isTop={i === 0} />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-4 justify-center pb-2">
        <button
          onClick={() => swipe('pass')}
          disabled={swiping || queue.length === 0}
          className="flex-1 py-4 rounded-2xl text-lg font-semibold border-2 border-red-300 text-red-500 disabled:opacity-40"
          aria-label={t.discovery.pass}
        >
          ✕ {t.discovery.pass}
        </button>
        <button
          onClick={() => swipe('like')}
          disabled={swiping || queue.length === 0}
          className="flex-1 py-4 rounded-2xl text-lg font-semibold border-2 border-green-300 text-green-600 disabled:opacity-40"
          aria-label={t.discovery.like}
        >
          ❤️ {t.discovery.like}
        </button>
      </div>
    </div>
  )
}
