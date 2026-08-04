import { useEffect, useState } from 'react'
import { api } from '../../api.js'
import { haptic } from '../../telegram.js'
import { t } from '../../i18n.js'
import type { GiftIntro } from '../../types.js'

interface Props {
  /** Opens the chat for a matchId, reusing the Matches screen's existing navigation. */
  onOpenChat: (matchId: string) => void
  refreshKey: number
}

type BusyAction = 'accept' | 'dismiss'
type Busy = { id: string; action: BusyAction } | null

const Spinner = () => (
  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
)

export function IntrosSection({ onOpenChat, refreshKey }: Props) {
  const [intros, setIntros] = useState<GiftIntro[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // On silent refreshes a failure just keeps the stale list, mirroring Matches.
    api.gifts.intros()
      .then(({ intros: list }) => setIntros(list))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [refreshKey])

  const handleAccept = async (intro: GiftIntro) => {
    if (busy) return
    haptic.impact('medium')
    setBusy({ id: intro.id, action: 'accept' })
    setError(null)
    try {
      const { matchId } = await api.gifts.acceptIntro(intro.id)
      setIntros((prev) => prev.filter((i) => i.id !== intro.id))
      onOpenChat(matchId)
    } catch {
      setError(t.gifts.introAcceptError)
    } finally {
      setBusy(null)
    }
  }

  const handleDismiss = async (intro: GiftIntro) => {
    if (busy) return
    setBusy({ id: intro.id, action: 'dismiss' })
    setError(null)
    try {
      await api.gifts.dismissIntro(intro.id)
      setIntros((prev) => prev.filter((i) => i.id !== intro.id))
    } catch {
      setError(t.gifts.introDismissError)
    } finally {
      setBusy(null)
    }
  }

  if (!loaded || intros.length === 0) return null

  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      <h2 className="text-[13px] font-bold uppercase tracking-widest text-white/50 px-1">
        {t.gifts.introsTitle}
      </h2>

      {error && <p className="text-rose-400 text-[13px] px-1">{error}</p>}

      {intros.map((intro) => {
        const isBusy = busy?.id === intro.id
        const disabled = busy !== null

        return (
          <div
            key={intro.id}
            className="glass border border-white/12 rounded-[24px] shadow-2xl flex flex-col gap-3 p-4"
          >
            <div className="flex items-center gap-3">
              {intro.buyer.photo
                ? <img
                    src={intro.buyer.photo}
                    alt={intro.buyer.name}
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-white/20"
                  />
                : <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl ring-2 ring-white/20">
                    👤
                  </div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[16px] text-white truncate">{intro.buyer.name}</p>
                <p className="text-[13px] text-white/55">{t.gifts.introSubtitle}</p>
              </div>
              <span className="text-3xl flex-shrink-0">{intro.emoji ?? '🎁'}</span>
            </div>

            {intro.note && (
              <p className="text-white/80 text-[14px] border border-white/10 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,.06)' }}>
                {intro.note}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDismiss(intro)}
                disabled={disabled}
                className="flex-1 flex items-center justify-center rounded-[16px] bg-white/10 border border-white/15 py-2.5 text-white/80 font-semibold text-[14px] disabled:opacity-50"
              >
                {isBusy && busy?.action === 'dismiss' ? <Spinner /> : t.gifts.dismiss}
              </button>
              <button
                type="button"
                onClick={() => handleAccept(intro)}
                disabled={disabled}
                className="flex-1 grad-tg flex items-center justify-center text-white font-bold text-[14px] py-2.5 rounded-[16px] disabled:opacity-50"
                style={{ boxShadow: '0 8px 22px rgba(0,136,204,.45)' }}
              >
                {isBusy && busy?.action === 'accept' ? <Spinner /> : t.gifts.accept}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
