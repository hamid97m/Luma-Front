import { useEffect, useState } from 'react'
import { t } from '../i18n.js'
import { api } from '../api.js'
import { haptic, markWriteAccessDismissed, markWriteAccessPrompted, requestWriteAccess } from '../telegram.js'
import { Button, Icon, Sheet } from './ui'

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
    } else {
      markWriteAccessDismissed()
    }
    onDone()
  }

  const dismiss = () => {
    markWriteAccessDismissed()
    onDone()
  }

  return (
    <Sheet open onClose={dismiss}>
      <div className="w-14 h-14 rounded-m3-lg bg-primary-container flex items-center justify-center mb-3.5">
        <Icon name="bell" size={26} className="text-primary" />
      </div>
      <h2 className="text-[22px] font-medium text-txt mb-1.5">{t.notify.title}</h2>
      <p className="text-txt2 mb-5 text-[14px] leading-relaxed">{t.notify.body}</p>

      <Button onClick={enable} disabled={busy} block size="lg" className="mb-2">
        {t.notify.enable}
      </Button>
      <Button onClick={dismiss} variant="text" block size="md">
        {t.notify.later}
      </Button>
    </Sheet>
  )
}
