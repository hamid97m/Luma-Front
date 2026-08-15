import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { t } from '../i18n.js'
import { relativeTime } from '../i18n/format.js'
import { haptic } from '../telegram.js'
import { usePremiumStore } from '../store.js'
import { PaywallSheet } from '../components/premium/PaywallSheet.js'
import { MatchPopup } from '../components/MatchPopup.js'
import { LikerProfileSheet } from '../components/LikerProfileSheet.js'
import { Icon } from '../components/ui/index.js'
import type { LikerProfile, LockedLiker, Match, SwipeResult } from '../types.js'

// Fallback for a locked liker with no photo — a theme-token gradient (blurred
// behind the lock badge, same as the real-photo tiles).
const LOCKED_GRADIENTS = [
  'linear-gradient(135deg, var(--pc), var(--pr))',
  'linear-gradient(150deg, var(--pr), var(--gold))',
  'linear-gradient(120deg, var(--gold), var(--pc))',
]

export function Likes({ onOpenChat }: { onOpenChat: (m: Match) => void }) {
  const [visible, setVisible] = useState<LikerProfile[]>([])
  const [locked, setLocked] = useState<LockedLiker[]>([])
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

  const load = () =>
    api.likes
      .list()
      .then((r) => { setVisible(r.visible); setLocked(r.locked) })
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [])
  // Re-fetch when the paywall closes — a purchase may have unlocked likers.
  useEffect(() => {
    if (prevPayOpenRef.current && !payOpen) load()
    prevPayOpenRef.current = payOpen
  }, [payOpen])

  const openPaywall = () => { haptic.impact('medium'); setPayOpen(true) }

  const pass = async (l: LikerProfile) => {
    if (acting) return
    haptic.impact('light')
    setActing(true)
    try { await api.swipes.swipe(l.id, 'pass') } catch { /* optimistic — drop anyway */ }
    setVisible((v) => v.filter((x) => x.id !== l.id))
    setOpenLiker(null)
    setActing(false)
  }

  const likeBack = async (l: LikerProfile) => {
    if (acting) return
    haptic.impact('medium')
    setActing(true)
    try {
      const res = await api.swipes.swipe(l.id, 'like')
      setVisible((v) => v.filter((x) => x.id !== l.id))
      setOpenLiker(null)
      // A liker liking back is by definition a mutual like → a match. Fire the
      // existing "It's a Match" dialog rather than opening chat directly.
      if (res.matched && res.match) setMatchPopup(res.match)
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
  const total = visible.length + lockedCount
  const isEmpty = total === 0
  const subtitle =
    lockedCount > 0
      ? t.likes.subtitleHidden(total, lockedCount)
      : isPremium
        ? t.likes.subtitleAllVisible(total)
        : t.likes.subtitle(total)

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-bg text-txt">
      {!isEmpty && <p className="px-5 pt-6 pb-1 text-[13px] text-txt2">{subtitle}</p>}

      {lockedCount > 0 && (
        <button
          type="button"
          onClick={openPaywall}
          className="mx-4 mt-3 mb-1 rounded-[20px] p-4 flex items-center gap-3 text-left bg-primary-container"
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
          <Icon name="chevron-right" size={18} className="text-on-primary-container flex-none" />
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
      ) : (
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
                <span className="min-w-0 text-left">
                  <span className="block text-[15px] font-medium text-white whitespace-nowrap overflow-hidden text-ellipsis">
                    {l.name}
                    {l.age != null ? `, ${l.age}` : ''}
                  </span>
                  <span className="block text-[11px] text-white/80">{relativeTime(l.likedAt)}</span>
                </span>
                {!isPremium && (
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
            <button
              key={`locked-${i}`}
              type="button"
              onClick={openPaywall}
              aria-label={t.likes.premium}
              className="relative aspect-[3/4] rounded-m3-lg overflow-hidden bg-surface-high"
            >
              {l.photo ? (
                // Real photo, lightly blurred client-side (the teaser). The URL is
                // the unblurred original — see the note in backend/src/routes/likes.ts.
                <img
                  src={l.photo}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ filter: 'blur(8px)', transform: 'scale(1.08)' }}
                />
              ) : (
                <span
                  className="absolute inset-0"
                  style={{
                    background: LOCKED_GRADIENTS[i % LOCKED_GRADIENTS.length],
                    filter: 'blur(8px) saturate(.8)',
                    transform: 'scale(1.08)',
                  }}
                  aria-hidden="true"
                />
              )}
              <span className="absolute inset-0" style={{ background: 'rgba(33,26,29,.28)' }} />
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <span
                  className="w-[38px] h-[38px] rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,.92)', boxShadow: '0 3px 10px rgba(0,0,0,.2)' }}
                >
                  <Icon name="lock" size={17} className="text-primary" />
                </span>
                <span
                  className="text-[11px] font-semibold uppercase tracking-wide text-white"
                  style={{ textShadow: '0 1px 4px rgba(0,0,0,.5)' }}
                >
                  {t.likes.premium}
                </span>
              </span>
            </button>
          ))}
        </div>
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
