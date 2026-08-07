import { useState, useEffect, useCallback, useRef } from 'react'
import { t } from '../i18n.js'
import { api } from '../api.js'
import { CardStack } from '../components/CardStack.js'
import { MatchPopup } from '../components/MatchPopup.js'
import { NotifyPrompt } from '../components/NotifyPrompt.js'
import { GiftPickerSheet } from '../components/gifts/GiftPickerSheet.js'
import { shouldPromptWriteAccess, haptic } from '../telegram.js'
import { DiscoveryEmpty } from '../components/DiscoveryEmpty.js'
import { SwipeLimited } from '../components/SwipeLimited.js'
import { PaywallSheet } from '../components/premium/PaywallSheet.js'
import { usePremiumStore } from '../store.js'
import type { DiscoveryProfile, SwipeResult, Match } from '../types.js'

const PREFETCH_THRESHOLD = 2

// Server resetAt with a floor: a device clock ahead of the server would
// otherwise mount SwipeLimited already-expired and refetch-loop; the floor
// degrades that worst case into a gentle 5s poll.
const floorResetAt = (iso: string) => new Date(Math.max(Date.parse(iso), Date.now() + 5000)).toISOString()

interface Props {
  onOpenChat: (match: Match) => void
}

export function Discovery({ onOpenChat }: Props) {
  const [queue, setQueue] = useState<DiscoveryProfile[]>([])
  const [exhausted, setExhausted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [swiping, setSwiping] = useState(false)
  const [activeMatch, setActiveMatch] = useState<NonNullable<SwipeResult['match']> | null>(null)
  const [showNotifyPrompt, setShowNotifyPrompt] = useState(false)
  const [giftTarget, setGiftTarget] = useState<{ id: string; name: string } | null>(null)
  // Every id swiped this session — outlives the queue, so a prefetch response
  // started before a swipe (and thus unaware of it) can't re-add that profile.
  const swipedIds = useRef<Set<string>>(new Set())
  const [limitResetAt, setLimitResetAt] = useState<string | null>(null)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const premiumStatus = usePremiumStore((s) => s.status)
  // Buying premium clears the limit instantly (server stops gating; no refetch needed).
  const premiumActive =
    !!premiumStatus?.premiumUntil && new Date(premiumStatus.premiumUntil).getTime() > Date.now()
  const limited = limitResetAt != null && !premiumActive

  const fetchBatch = useCallback(async () => {
    const { profiles, exhausted: done, swipeLimit } = await api.discovery.feed()
    setQueue((q) => {
      const seen = new Set(q.map((p) => p.id))
      return [...q, ...profiles.filter((p) => !seen.has(p.id) && !swipedIds.current.has(p.id))]
    })
    setExhausted(done)
    if (swipeLimit?.limited && swipeLimit.resetAt) setLimitResetAt(floorResetAt(swipeLimit.resetAt))
    setLoading(false)
  }, [])

  useEffect(() => { fetchBatch() }, [fetchBatch])

  // "Review profiles again" — re-check the feed (e.g. new people joined).
  const refresh = useCallback(() => {
    setLoading(true)
    setExhausted(false)
    setQueue([])
    fetchBatch()
  }, [fetchBatch])

  const swipe = async (direction: 'like' | 'pass') => {
    const [current, ...rest] = queue
    if (!current || swiping) return

    swipedIds.current.add(current.id)
    setSwiping(true)
    setQueue(rest)

    try {
      const result = await api.swipes.swipe(current.id, direction)
      if (result.swipeLimit?.remaining === 0) setLimitResetAt(floorResetAt(result.swipeLimit.resetAt))
      if (result.matched && result.match) {
        // Small delay so card animation can finish before popup
        setTimeout(() => setActiveMatch(result.match!), 400)
      }
      // Prefetch next batch when queue runs low
      if (rest.length <= PREFETCH_THRESHOLD && !exhausted) fetchBatch()
    } catch (err) {
      // The swipe never reached the server — put the card back.
      swipedIds.current.delete(current.id)
      setQueue((q) => [current, ...q])
      const status = (err as { status?: number } | null)?.status
      const message = err instanceof Error ? err.message : ''
      if (status === 403 && message.includes('swipe_limit')) {
        // request() throws Error(bodyText), so the 403 body's resetAt is parseable.
        let resetAt: string | null = null
        try { resetAt = (JSON.parse(message) as { resetAt?: string }).resetAt ?? null } catch { /* not JSON */ }
        setLimitResetAt(resetAt ? floorResetAt(resetAt) : new Date(Date.now() + 4 * 3600_000).toISOString())
        usePremiumStore.getState().refresh()
      }
      haptic.notification('error')
    } finally {
      setSwiping(false)
    }
  }

  // The swipe response only carries a minimal match shape (id + counterpart
  // identity, no photos/timestamps) — synthesize the fields Chat needs with
  // safe defaults for a match that (by definition) has no messages yet.
  const openMatchChat = () => {
    if (!activeMatch) return
    onOpenChat({
      id: activeMatch.id,
      matchedAt: new Date().toISOString(),
      user: { ...activeMatch.user, photos: [], age: null, bio: null, icebreakerPrompt: null, icebreakerAnswer: null },
      lastMessage: null,
      unreadCount: 0,
    })
    setActiveMatch(null)
  }

  // Rendered on top of both the main card stack and the limited screen: a
  // like that lands as the 20th swipe can both match AND trip the limit, so
  // the match popup must still show even while `limited` is true.
  const matchPopupNode = (
    <>
      {activeMatch && (
        <MatchPopup
          match={activeMatch}
          onClose={() => {
            setActiveMatch(null)
            // They just matched but the bot still can't reach them — second
            // (and last) chance this session to ask for notifications.
            if (shouldPromptWriteAccess()) setShowNotifyPrompt(true)
          }}
          onMessage={openMatchChat}
        />
      )}
      {showNotifyPrompt && <NotifyPrompt onDone={() => setShowNotifyPrompt(false)} />}
    </>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-bg text-txt">
        <img src="/luma-icon.png" alt="" className="w-14 h-14 rounded-m3-lg animate-pulse-heart select-none" />
      </div>
    )
  }

  if (limited) {
    return (
      <div className="h-full bg-bg text-txt flex flex-col">
        <SwipeLimited
          resetAt={limitResetAt!}
          onExpired={() => { setLimitResetAt(null); refresh() }}
          onGetPremium={() => { haptic.impact('medium'); setPaywallOpen(true) }}
        />
        <PaywallSheet
          open={paywallOpen}
          onClose={() => setPaywallOpen(false)}
          subtitle={t.swipeLimit.paywallSubtitle}
        />
        {matchPopupNode}
      </div>
    )
  }

  if (exhausted && queue.length === 0) {
    return (
      <div className="h-full bg-bg text-txt flex flex-col">
        <DiscoveryEmpty onReview={refresh} />
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
        onGiftClick={(profile) => setGiftTarget({ id: profile.id, name: profile.name })}
      />
      {giftTarget && (
        <GiftPickerSheet
          open={true}
          onClose={() => setGiftTarget(null)}
          target={{ context: 'discovery', targetUserId: giftTarget.id }}
          recipientName={giftTarget.name}
          onSent={() => {
            window.Telegram?.WebApp?.showAlert?.(t.gifts.sentToast(giftTarget.name))
            setGiftTarget(null)
          }}
        />
      )}
      {matchPopupNode}
    </>
  )
}
