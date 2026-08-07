import { useEffect, useState } from 'react'
import { api } from '../../api.js'
import { haptic } from '../../telegram.js'
import { t } from '../../i18n.js'
import type { GiftIntro } from '../../types.js'
import { Avatar, Button, Card, Icon } from '../ui'

interface Props {
  /** Opens the chat for a matchId, reusing the Matches screen's existing navigation. */
  onOpenChat: (matchId: string) => void
  refreshKey: number
}

type BusyAction = 'accept' | 'dismiss'
type Busy = { id: string; action: BusyAction } | null

const Spinner = () => (
  <span
    className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"
    style={{ animation: 'lumaSpin .8s linear infinite' }}
  />
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
      <h2 className="text-[13px] font-bold uppercase tracking-widest text-txt2 px-1">
        {t.gifts.introsTitle}
      </h2>

      {error && <p className="text-error text-[13px] px-1">{error}</p>}

      {intros.map((intro) => {
        const isBusy = busy?.id === intro.id
        const disabled = busy !== null

        return (
          <Card key={intro.id} variant="filled" elevated className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Avatar src={intro.buyer.photo} size={56} alt={intro.buyer.name} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[16px] text-txt truncate">{intro.buyer.name}</p>
                <p className="text-[13px] text-txt2">{t.gifts.introSubtitle}</p>
              </div>
              {intro.emoji ? (
                <span className="text-3xl flex-shrink-0">{intro.emoji}</span>
              ) : (
                <Icon name="gift" size={28} className="text-primary flex-shrink-0" />
              )}
            </div>

            {intro.note && (
              <p className="text-txt text-[14px] rounded-m3-md p-3 bg-surface-high">
                {intro.note}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="tonal"
                onClick={() => handleDismiss(intro)}
                disabled={disabled}
                className="flex-1"
              >
                {isBusy && busy?.action === 'dismiss' ? <Spinner /> : t.gifts.dismiss}
              </Button>
              <Button
                variant="filled"
                onClick={() => handleAccept(intro)}
                disabled={disabled}
                className="flex-1"
              >
                {isBusy && busy?.action === 'accept' ? <Spinner /> : t.gifts.accept}
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
