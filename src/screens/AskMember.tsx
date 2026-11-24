// Member answer screen — opened from the bot DM button (WEB_URL?screen=ask&r=<recipientId>).
import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { t } from '../i18n.js'
import { useBackButton } from '../telegram.js'
import { Button } from '../components/ui/index.js'
import { AskAnswer, AskStateMessage } from '../components/ask/AskAnswer.js'
import { AskLangToggle } from '../components/ask/AskLangToggle.js'
import { errorBody } from '../components/ask/askUtils.js'
import type { AskRecipientView } from '../types.js'

interface Props {
  recipientId: string
  onClose: () => void
}

export function AskMember({ recipientId, onClose }: Props) {
  const [view, setView] = useState<AskRecipientView | null>(null)
  const [failed, setFailed] = useState<'closed' | 'error' | null>(null)
  useBackButton(true, onClose)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const v = await api.asks.forMe(recipientId)
        if (!alive) return
        // ask_viewed / ask_answered are recorded server-side.
        setView(v)
      } catch (err) {
        if (!alive) return
        const { status } = errorBody(err)
        // Not mine / gone / blocked → present it as ended, never leak why.
        setFailed(status === 404 || status === 403 || status === 409 ? 'closed' : 'error')
      }
    })()
    return () => { alive = false }
  }, [recipientId])

  const wrap = (node: React.ReactNode) => (
    <div className="fixed inset-0 z-40 bg-bg text-txt flex flex-col" data-testid="ask-member">{node}</div>
  )

  if (failed) {
    return wrap(
      <>
        <div className="flex justify-end px-3 pt-2" style={{ marginTop: 'var(--tg-safe-top)' }}>
          <AskLangToggle saveNow />
        </div>
        <AskStateMessage icon="clock" title={failed === 'closed' ? t.ask.closed : t.errors.generic}>
          <Button variant="tonal" onClick={onClose}>{t.ask.backToLuma}</Button>
        </AskStateMessage>
      </>,
    )
  }

  if (!view) {
    return wrap(
      <div className="flex-1 flex items-center justify-center">
        <img src="/luma-icon.png" alt="" className="w-14 h-14 rounded-m3-lg animate-pulse-heart select-none" />
      </div>,
    )
  }

  return wrap(
    <AskAnswer
      view={view}
      recipientKind="member"
      onBack={onClose}
      onSubmit={async (verdict, note) => { await api.asks.answerForMe(recipientId, verdict, note) }}
      thanksFooter={<Button block variant="tonal" size="lg" onClick={onClose}>{t.ask.backToLuma}</Button>}
    />,
  )
}
