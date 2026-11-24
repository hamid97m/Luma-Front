import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { t } from '../i18n.js'
import { formatLongDate, relativeTime } from '../i18n/format.js'
import { haptic } from '../telegram.js'
import { usePremiumStore, useReferralStore } from '../store.js'
import { PaywallSheet } from '../components/premium/PaywallSheet.js'
import { MatchPopup } from '../components/MatchPopup.js'
import { LikerProfileSheet } from '../components/LikerProfileSheet.js'
import { LikesQueue, LockedTile } from '../components/LikesQueue.js'
import { Icon } from '../components/ui/index.js'
import { PremiumBadge } from '../components/premium/PremiumBadge.js'
import { AskWaitingList } from '../components/ask/AskWaitingList.js'
import { useAskConfigStore, useMyAsksStore } from '../components/ask/askUtils.js'
import type { LikerProfile, LikesQueueInfo, LockedLiker, Match, SwipeResult } from '../types.js'

interface LikesProps {
  onOpenChat: (m: Match) => void
  /** «منتظر نظر» card → that ask's results (rendered by App). */
  onOpenAskResults?: (askId: string) => void
}

export function Likes({ onOpenChat, onOpenAskResults }: LikesProps) {
  // Women with "ask a friend": the tab is «برای تو» with a likes / waiting-for-opinion switch.
  const askMode = useAskConfigStore((s) => s.enabled)
  const asksCount = useMyAsksStore((s) => s.asks.length)
  const [segment, setSegment] = useState<'likes' | 'asks'>('likes')
  useEffect(() => { if (askMode) useMyAsksStore.getState().load() }, [askMode])
  const [visible, setVisible] = useState<LikerProfile[]>([])
  const [locked, setLocked] = useState<LockedLiker[]>([])
  // Women: the likes behind today's free one, or how long all of them are open.
  const [queue, setQueue] = useState<LikesQueueInfo | null>(null)
  const [unlockedUntil, setUnlockedUntil] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [payOpen, setPayOpen] = useState(false)
  const [openLiker, setOpenLiker] = useState<LikerProfile | null>(null)
  const [acting, setActing] = useState(false)
  const [matchPopup, setMatchPopup] = useState<SwipeResult['match'] | null>(null)

  const premiumUntil = usePremiumStore((s) => s.status?.premiumUntil)
  const isPremium = !!premiumUntil && new Date(premiumUntil).getTime() > Date.now()

  // Tracks the previous payOpen value so the close-effect only re-fetches on a
  // real true -> false transition, not on the initial mount.
  const prevPayOpenRef = useRef(false)

  // A response is dropped when a newer load or a swipe happened after it was
  // requested — otherwise it would bring back someone she just answered.
  const loadSeq = useRef(0)
  const load = () => {
    const seq = ++loadSeq.current
    return api.likes
      .list()
      .then((r) => {
        if (seq !== loadSeq.current) return
        setVisible(r.visible)
        setLocked(r.locked)
        setQueue(r.queue && r.queue.lockedCount > 0 ? r.queue : null)
        setUnlockedUntil(r.unlockedUntil ?? null)
      })
      .catch(() => { /* keep what is on screen */ })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  // Re-fetch when the paywall closes — a purchase may have unlocked likers.
  useEffect(() => {
    if (prevPayOpenRef.current && !payOpen) load()
    prevPayOpenRef.current = payOpen
  }, [payOpen])

  // A friend may have joined: re-fetch when the invite sheet closes and when she
  // comes back to the app.
  const inviteOpen = useReferralStore((s) => s.sheetOpen)
  const likesReward = useReferralStore((s) => (s.status?.enabled ? s.status.likesReward : null))
  const prevInviteOpenRef = useRef(inviteOpen)
  useEffect(() => {
    if (prevInviteOpenRef.current && !inviteOpen) load()
    prevInviteOpenRef.current = inviteOpen
  }, [inviteOpen])
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const openInvite = () => { haptic.selection(); useReferralStore.getState().openSheet() }
  const openPaywall = () => { haptic.impact('medium'); setPayOpen(true) }

  const pass = async (l: LikerProfile) => {
    if (acting) return
    haptic.impact('light')
    setActing(true)
    loadSeq.current++
    try { await api.swipes.swipe(l.id, 'pass') } catch { /* optimistic — drop anyway */ }
    loadSeq.current++
    setVisible((v) => v.filter((x) => x.id !== l.id))
    setOpenLiker(null)
    setActing(false)
  }

  const likeBack = async (l: LikerProfile) => {
    if (acting) return
    haptic.impact('medium')
    setActing(true)
    try {
      loadSeq.current++
      const res = await api.swipes.swipe(l.id, 'like')
      loadSeq.current++
      setVisible((v) => v.filter((x) => x.id !== l.id))
      setOpenLiker(null)
      // A liker liking back is by definition a mutual like → a match. Fire the
      // existing "It's a Match" dialog rather than opening chat directly.
      if (res.matched && res.match) {
        setMatchPopup({ ...res.match, user: { ...res.match.user, premium: l.premium } })
      }
    } catch {
      haptic.notification('error')
    } finally {
      setActing(false)
    }
  }

  // MatchPopup "Send a message" → build the minimal Match the chat needs from the
  // swipe response (mirrors Discovery.tsx) and open the chat.
  const openMatchChat = () => {
    const m = matchPopup
    if (!m) return
    setMatchPopup(null)
    onOpenChat({
      id: m.id,
      matchedAt: new Date().toISOString(),
      user: { ...m.user, photos: [], age: null, bio: null, icebreakerPrompt: null, icebreakerAnswer: null },
      lastMessage: null,
      unreadCount: 0,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-bg text-txt">
        <img src="/luma-icon.png" alt="" className="w-14 h-14 rounded-2xl animate-pulse-heart select-none" />
      </div>
    )
  }

  const lockedCount = locked.length
  const total = visible.length + lockedCount + (queue?.lockedCount ?? 0)
  const isEmpty = total === 0
  const subtitle =
    lockedCount > 0
      ? t.likes.subtitleHidden(total, lockedCount)
      : isPremium || unlockedUntil
        ? t.likes.subtitleAllVisible(total)
        : t.likes.subtitle(total)

  const segmentBar = askMode && (
    <div className="flex p-1 mx-4 mt-4 mb-1 rounded-full bg-surface gap-1 flex-none" role="tablist">
      {([
        ['likes', t.likes.segmentLikes(total)],
        ['asks', t.likes.segmentAsks(asksCount)],
      ] as const).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={segment === id}
          onClick={() => { if (segment !== id) haptic.selection(); setSegment(id) }}
          className={`flex-1 h-10 rounded-full text-[14px] font-medium transition-colors ${
            segment === id ? 'bg-primary-container text-on-primary-container' : 'text-txt2'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )

  if (askMode && segment === 'asks') {
    return (
      <div className="flex flex-col h-full overflow-y-auto bg-bg text-txt gap-3">
        {segmentBar}
        <AskWaitingList
          onOpenResults={(id) => onOpenAskResults?.(id)}
          onMatch={(m) => setMatchPopup(m)}
        />
        {matchPopup && (
          <MatchPopup match={matchPopup} onClose={() => setMatchPopup(null)} onMessage={openMatchChat} />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-bg text-txt">
      {segmentBar}
      {unlockedUntil && (
        <div
          className={`mx-4 ${askMode ? 'mt-3' : 'mt-5'} rounded-full bg-primary-container ps-4 pe-1.5 py-1.5 flex items-center gap-2`}
          data-testid="likes-unlocked"
        >
          <Icon name="heart" size={15} className="text-primary flex-none" />
          <span className="flex-1 min-w-0 text-[12.5px] font-medium text-on-primary-container">
            {t.likes.unlockedUntil(formatLongDate(new Date(unlockedUntil)))}
          </span>
          {likesReward && (
            <button
              type="button"
              onClick={openInvite}
              className="flex-none h-8 px-3 rounded-full bg-primary text-white text-[12px] font-medium"
            >
              {t.likes.unlockedMore(likesReward.daysPerFriend)}
            </button>
          )}
        </div>
      )}
      {!isEmpty && !queue && <p className={`px-5 ${askMode ? 'pt-3' : 'pt-6'} pb-1 text-[13px] text-txt2`}>{subtitle}</p>}

      {lockedCount > 0 && (
        <button
          type="button"
          onClick={openPaywall}
          className="mx-4 mt-3 mb-1 rounded-[20px] p-4 flex items-center gap-3 text-start bg-primary-container"
        >
          <span className="w-11 h-11 rounded-full flex items-center justify-center flex-none bg-primary">
            <Icon name="lock" size={20} className="text-white" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-medium text-on-primary-container">{t.likes.bannerCount(lockedCount)}</span>
            <span className="block mt-0.5 text-[12.5px] leading-snug text-on-primary-container" style={{ opacity: 0.7 }}>
              {t.likes.bannerSub}
            </span>
          </span>
          <Icon name="chevron-right" size={18} className="rtl:-scale-x-100 text-on-primary-container flex-none" />
        </button>
      )}

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-10 pb-12">
          <div className="w-[76px] h-[76px] rounded-full bg-surface flex items-center justify-center mb-1.5">
            <Icon name="heart" size={30} className="text-primary" />
          </div>
          <h2 className="text-[22px] font-medium text-txt">{t.likes.empty}</h2>
          <p className="text-txt2 text-[14px] leading-relaxed max-w-[250px]">{t.likes.emptySub}</p>
        </div>
      ) : visible.length + lockedCount > 0 && (
        <div className="grid grid-cols-2 gap-3 p-4">
          {visible.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => { haptic.selection(); setOpenLiker(l) }}
              className="relative aspect-[3/4] rounded-m3-lg overflow-hidden bg-surface-high"
            >
              {l.photos[0] ? (
                <img src={l.photos[0]} alt={l.name} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Icon name="user" size={30} className="text-txt3" />
                </span>
              )}
              <span
                className="absolute inset-0"
                style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(0,0,0,.62) 100%)' }}
              />
              <span className="absolute left-2.5 right-2.5 bottom-2.5 flex items-end justify-between gap-2">
                <span className="min-w-0 text-start">
                  <span className="flex items-center gap-1 text-[15px] font-medium text-white min-w-0">
                    <span className="truncate">
                      {l.name}
                      {l.age != null ? `, ${l.age}` : ''}
                    </span>
                    {l.premium && <PremiumBadge size={15} />}
                  </span>
                  <span className="block text-[11px] text-white/80">{relativeTime(l.likedAt)}</span>
                </span>
                {!isPremium && !unlockedUntil && (
                  <span
                    className="text-[9.5px] font-bold uppercase tracking-wide px-[7px] py-[3px] rounded-full text-primary flex-none"
                    style={{ background: 'rgba(255,255,255,.92)' }}
                  >
                    {t.likes.free}
                  </span>
                )}
              </span>
            </button>
          ))}

          {locked.map((l, i) => (
            // Real photo, lightly blurred client-side (the teaser). The URL is the
            // unblurred original — see the note in backend/src/routes/likes.ts.
            <LockedTile
              key={`locked-${i}`}
              photo={l.photo}
              index={i}
              ariaLabel={t.likes.premium}
              caption={t.likes.premium}
              onClick={openPaywall}
            />
          ))}
        </div>
      )}

      {queue && (
        <LikesQueue
          queue={queue}
          hasFreeLike={visible.length + lockedCount > 0}
          onInvite={() => useReferralStore.getState().openSheet()}
          onPremium={() => setPayOpen(true)}
        />
      )}

      {openLiker && (
        <LikerProfileSheet
          liker={openLiker}
          busy={acting}
          onClose={() => setOpenLiker(null)}
          onPass={() => pass(openLiker)}
          onLikeBack={() => likeBack(openLiker)}
        />
      )}

      {matchPopup && (
        <MatchPopup match={matchPopup} onClose={() => setMatchPopup(null)} onMessage={openMatchChat} />
      )}

      <PaywallSheet open={payOpen} onClose={() => setPayOpen(false)} subtitle={t.likes.paywallSubtitle} />
    </div>
  )
}
