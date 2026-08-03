import { useEffect, useState } from 'react'
import { t } from '../i18n.js'
import { api } from '../api.js'
import { haptic, markWriteAccessPrompted, requestWriteAccess } from '../telegram.js'

interface Props {
  onDone: () => void
}

// Soft explainer shown before Telegram's native "Allow bot to message you?"
// popup — an unexplained system dialog gets reflexively declined, so we make
// the ask at a moment of intent and let the user opt into the native prompt.
export function NotifyPrompt({ onDone }: Props) {
  const [busy, setBusy] = useState(false)

  useEffect(() => { markWriteAccessPrompted() }, [])

  const enable = async () => {
    setBusy(true)
    const granted = await requestWriteAccess()
    if (granted) {
      haptic.notification('success')
      // initData only refreshes next launch — record the grant server-side now
      api.profile.setWriteAccess(true).catch(() => {})
    }
    onDone()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4"
      style={{ paddingBottom: 'calc(var(--tg-safe-bottom, 0px) + 1rem)' }}
    >
      <div className="glass border border-white/15 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl">
        <div className="text-4xl mb-3">💌</div>
        <h2 className="text-xl font-bold text-white mb-2">{t.notify.title}</h2>
        <p className="text-white/60 mb-5 text-[15px]">{t.notify.body}</p>

        <button onClick={enable} disabled={busy} className="btn-primary w-full mb-2">
          {t.notify.enable}
        </button>

        <button onClick={onDone} className="w-full py-3 text-white/50 font-semibold">
          {t.notify.later}
        </button>
      </div>
    </div>
  )
}
