import { useState, useEffect, useCallback, useRef } from 'react'
import { t } from '../i18n.js'
import { api } from '../api.js'
import { CardStack } from '../components/CardStack.js'
import { MatchPopup } from '../components/MatchPopup.js'
import { NotifyPrompt } from '../components/NotifyPrompt.js'
import { GiftPickerSheet } from '../components/gifts/GiftPickerSheet.js'
import { shouldPromptWriteAccess } from '../telegram.js'
import { Icon } from '../components/ui/index.js'
import type { DiscoveryProfile, SwipeResult, Match } from '../types.js'

const PREFETCH_THRESHOLD = 2

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-bg text-txt">
        <img src="/luma-icon.png" alt="" className="w-14 h-14 rounded-m3-lg animate-pulse-heart select-none" />
      </div>
    )
  }

  if (exhausted && queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8 bg-bg text-txt">
        <div className="w-[72px] h-[72px] rounded-m3-xl bg-primary-container text-primary flex items-center justify-center">
          <Icon name="flame" size={32} />
        </div>
        <h2 className="text-[22px] font-medium">{t.discovery.empty}</h2>
        <p className="text-txt2 text-[14px]">{t.discovery.emptyHint}</p>
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
}
