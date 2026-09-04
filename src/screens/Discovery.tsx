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
import { DirectChatSheet } from '../components/premium/DirectChatSheet.js'
import { usePremiumStore } from '../store.js'
import type { DiscoveryProfile, SwipeResult, Match, DirectChatStatus } from '../types.js'

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
  const [directChat, setDirectChat] = useState<DirectChatStatus>({ gate: 'free', remaining: 3, limit: 3, resetAt: null })
  const [chatTarget, setChatTarget] = useState<DiscoveryProfile | null>(null)
  const [chatMode, setChatMode] = useState<'paywall' | 'confirm' | 'limit'>('confirm')
  const [chatPaywallOpen, setChatPaywallOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const premiumStatus = usePremiumStore((s) => s.status)
  // Buying premium clears the limit instantly (server stops gating; no refetch needed).
  const premiumActive =
    !!premiumStatus?.premiumUntil && new Date(premiumStatus.premiumUntil).getTime() > Date.now()
  const limited = limitResetAt != null && !premiumActive

  const fetchBatch = useCallback(async () => {
    const { profiles, exhausted: done, swipeLimit, directChat: dc } = await api.discovery.feed()
    setQueue((q) => {
      const seen = new Set(q.map((p) => p.id))
      return [...q, ...profiles.filter((p) => !seen.has(p.id) && !swipedIds.current.has(p.id))]
    })
    setExhausted(done)
    if (dc) setDirectChat(dc)
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

  // Same synthesis as openMatchChat, for a match created via the direct-chat
  // route (its response carries the same minimal id + counterpart shape).
  const openDirectChat = (match: { id: string; user: { id: string; name: string; telegramId: number; username: string | null } }) => {
    onOpenChat({
      id: match.id,
      matchedAt: new Date().toISOString(),
      user: { ...match.user, photos: [], age: null, bio: null, icebreakerPrompt: null, icebreakerAnswer: null },
      lastMessage: null,
      unreadCount: 0,
    })
  }

  const startDirectChat = async (profile: DiscoveryProfile) => {
    if (starting) return
    setStarting(true)
    try {
      const { match, directChat: dc } = await api.directChat.start(profile.id)
      setChatTarget(null)
      // Trust the server's post-consume window (remaining + resetAt). It's only
      // present when a NEW match was created for a quota user — so re-chatting the
      // same person (existing match) never decrements, and the limit countdown
      // always has a real resetAt.
      if (dc) setDirectChat((d) => ({ ...d, remaining: dc.remaining, resetAt: dc.resetAt }))
      openDirectChat(match)
    } catch (err) {
      const status = (err as { status?: number } | null)?.status
      const message = err instanceof Error ? err.message : ''
      if (status === 403 && message.includes('direct_chat_limit')) {
        let resetAt: string | null = null
        try { resetAt = (JSON.parse(message) as { resetAt?: string }).resetAt ?? null } catch { /* not JSON */ }
        setDirectChat((d) => ({ ...d, gate: 'quota', remaining: 0, resetAt }))
        setChatMode('limit')
        setChatTarget(profile)
      } else if (status === 403 && message.includes('premium_required')) {
        setChatMode('paywall')
        setChatTarget(profile)
        usePremiumStore.getState().refresh()
      } else {
        haptic.notification('error')
        setChatTarget(null)
      }
    } finally {
      setStarting(false)
    }
  }

  const handleChatClick = (profile: DiscoveryProfile) => {
    // Premium (within today's quota) and free users chat directly — no sheet.
    // A 403 from the server (limit hit / premium expired) still surfaces the
    // right sheet via startDirectChat's catch.
    if (directChat.gate === 'free' || (directChat.gate === 'quota' && directChat.remaining > 0)) {
      startDirectChat(profile)
      return
    }
    // Non-premium → paywall pitch; premium who used all 3 today → limit sheet.
    setChatMode(directChat.gate === 'paywall' ? 'paywall' : 'limit')
    setChatTarget(profile)
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
        onChatClick={handleChatClick}
      />
      {chatTarget && (
        <DirectChatSheet
          open={!chatPaywallOpen}
          onClose={() => setChatTarget(null)}
          recipientName={chatTarget.name}
          mode={chatMode}
          remaining={directChat.remaining}
          resetAt={directChat.resetAt}
          starting={starting}
          onStart={() => startDirectChat(chatTarget)}
          onGoPremium={() => { haptic.impact('medium'); setChatPaywallOpen(true) }}
        />
      )}
      <PaywallSheet
        open={chatPaywallOpen}
        onClose={() => { setChatPaywallOpen(false); setChatTarget(null) }}
        subtitle={t.directChat.paywallSubtitle}
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
