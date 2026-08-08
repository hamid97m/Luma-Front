import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { t } from '../i18n.js'
import { haptic } from '../telegram.js'
import { PaywallSheet } from '../components/premium/PaywallSheet.js'
import { Icon } from '../components/ui/index.js'
import type { LikerProfile, Match } from '../types.js'

// Locked-liker placeholder tiles: no real photo exists for someone the viewer
// hasn't unlocked, so these are theme-token gradients (never fabricated
// imagery), heavily blurred and overlaid with the unlock CTA below.
const LOCKED_GRADIENTS = [
  'linear-gradient(135deg, var(--pc), var(--pr))',
  'linear-gradient(150deg, var(--pr), var(--gold))',
  'linear-gradient(120deg, var(--gold), var(--pc))',
]
const LOCKED_TILE_COUNT = 6

export function Likes({ onOpenChat }: { onOpenChat: (m: Match) => void }) {
  const [visible, setVisible] = useState<LikerProfile[]>([])
  const [lockedCount, setLockedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [payOpen, setPayOpen] = useState(false)
  const [likingId, setLikingId] = useState<string | null>(null)

  const load = () =>
    api.likes.list().then((r) => { setVisible(r.visible); setLockedCount(r.lockedCount) }).finally(() => setLoading(false))

  useEffect(() => { load() }, [])
  // Re-fetch when the paywall closes — a purchase may have unlocked likers.
  useEffect(() => { if (!payOpen) load() }, [payOpen])

  const likeBack = async (l: LikerProfile) => {
    if (likingId) return
    haptic.impact('medium')
    setLikingId(l.id)
    try {
      const res = await api.swipes.swipe(l.id, 'like')
      if (res.matched && res.match) {
        // Mirrors Discovery.tsx's openMatchChat: the swipe response only
        // carries a minimal match shape (id + counterpart identity, no
        // photos/timestamps) — synthesize the fields Chat needs with safe
        // defaults for a match that (by definition) has no messages yet.
        onOpenChat({
          id: res.match.id,
          matchedAt: new Date().toISOString(),
          user: { ...res.match.user, photos: [], age: null, bio: null, icebreakerPrompt: null, icebreakerAnswer: null },
          lastMessage: null,
          unreadCount: 0,
        })
      }
      // Either way, they're no longer a pending "liker" — drop the card.
      setVisible((v) => v.filter((x) => x.id !== l.id))
    } catch {
      haptic.notification('error')
    } finally {
      setLikingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-bg text-txt">
        <img src="/luma-icon.png" alt="" className="w-14 h-14 rounded-2xl animate-pulse-heart select-none" />
      </div>
    )
  }

  const isEmpty = visible.length === 0 && lockedCount === 0

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-bg text-txt">
      <div className="px-5 pt-8 pb-2">
        <h1 className="text-2xl font-medium text-txt">{t.likes.title}</h1>
      </div>

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-10 pb-12">
          <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center mb-1">
            <Icon name="heart" size={28} className="text-primary" />
          </div>
          <h2 className="text-[22px] font-medium text-txt">{t.likes.empty}</h2>
          <p className="text-txt2 text-[14px] leading-relaxed max-w-[240px]">{t.likes.emptySub}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4 pb-6 mt-2">
          {visible.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {visible.map((l) => (
                <div key={l.id} className="bg-surface rounded-m3-lg overflow-hidden flex flex-col">
                  <div className="relative aspect-[3/4] bg-surface-high">
                    {l.photos[0] ? (
                      <img src={l.photos[0]} alt={l.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon name="user" size={28} className="text-txt3" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col gap-2">
                    <p className="text-[14px] font-medium text-txt truncate">
                      {l.name}
                      {l.age != null ? `, ${l.age}` : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() => likeBack(l)}
                      disabled={likingId === l.id}
                      aria-label={`${t.likes.likeBack} ${l.name}`}
                      className="w-full h-9 rounded-full bg-primary text-white text-[13px] font-medium flex items-center justify-center gap-1.5 transition-opacity disabled:opacity-60"
                    >
                      {likingId === l.id ? (
                        <span
                          className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                          style={{ animation: 'lumaSpin .8s linear infinite' }}
                        />
                      ) : (
                        <>
                          <Icon name="heart" size={13} />
                          {t.likes.likeBack}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {lockedCount > 0 && (
            <div className="relative rounded-m3-lg overflow-hidden">
              <div
                className="grid grid-cols-3 gap-1.5 p-1.5"
                style={{ filter: 'blur(14px)' }}
                aria-hidden="true"
              >
                {Array.from({ length: LOCKED_TILE_COUNT }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-m3-md"
                    style={{ background: LOCKED_GRADIENTS[i % LOCKED_GRADIENTS.length] }}
                  />
                ))}
              </div>
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6"
                style={{ background: 'rgba(0,0,0,.34)' }}
              >
                <Icon name="lock" size={22} className="text-white" />
                <p className="text-white font-medium text-[15px] leading-snug">{t.likes.lockedCount(lockedCount)}</p>
                <button
                  type="button"
                  onClick={() => { haptic.impact('medium'); setPayOpen(true) }}
                  className="h-10 px-5 rounded-full bg-gold-btn text-[#241A00] font-medium text-[13px]"
                >
                  {t.likes.unlockCta}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <PaywallSheet open={payOpen} onClose={() => setPayOpen(false)} subtitle={t.likes.paywallSubtitle} />
    </div>
  )
}
