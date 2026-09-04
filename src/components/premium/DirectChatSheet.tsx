import { useEffect, useState } from 'react'
import { t } from '../../i18n.js'
import { formatCountdown } from '../../utils/premium.js'
import { Icon, Sheet } from '../ui'

interface DirectChatSheetProps {
  open: boolean
  onClose: () => void
  recipientName: string
  mode: 'paywall' | 'confirm' | 'limit'
  remaining: number
  resetAt: string | null
  starting: boolean
  onStart: () => void
  onGoPremium: () => void
}

export function DirectChatSheet({ open, onClose, recipientName, mode, remaining, resetAt, starting, onStart, onGoPremium }: DirectChatSheetProps) {
  // Live countdown for the 'limit' state.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!open || mode !== 'limit') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [open, mode])

  const title = mode === 'limit' ? t.directChat.limitTitle : t.directChat.title

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col items-center text-center gap-4 pb-2">
        <div className="w-14 h-14 rounded-full bg-primary/12 flex items-center justify-center text-primary">
          <Icon name="message-dots" size={26} />
        </div>

        <p className="text-[14px] text-txt2 leading-relaxed">
          {mode === 'limit' ? t.directChat.limitBody : t.directChat.body}
        </p>

        {mode === 'confirm' && (
          <p className="text-[13px] font-medium text-txt3">{t.directChat.remaining(remaining)}</p>
        )}

        {mode === 'limit' && resetAt && (
          <p className="text-[20px] font-semibold tabular-nums text-txt">
            {formatCountdown(Math.max(0, new Date(resetAt).getTime() - now))}
          </p>
        )}

        {mode === 'paywall' && (
          <button
            onClick={onGoPremium}
            className="w-full h-12 rounded-m3-lg bg-primary text-white font-medium hover:bg-primary-hover transition-colors"
          >
            {t.directChat.goPremiumCta}
          </button>
        )}

        {mode === 'confirm' && (
          <button
            onClick={onStart}
            disabled={starting}
            className="w-full h-12 rounded-m3-lg bg-primary text-white font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {t.directChat.startCta.replace('{name}', recipientName)}
          </button>
        )}
      </div>
    </Sheet>
  )
}
