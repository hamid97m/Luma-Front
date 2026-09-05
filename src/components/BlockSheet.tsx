import { useState } from 'react'
import { api } from '../api.js'
import { t } from '../i18n.js'
import { haptic } from '../telegram.js'
import { Button, Icon, Sheet } from './ui'

interface Props {
  open: boolean
  /** Display name of the person being blocked. */
  name: string
  /** User id of the person being blocked. */
  userId: string
  onClose: () => void
  /** Called after the block succeeds — the caller leaves the chat. */
  onBlocked: () => void
}

export function BlockSheet({ open, name, userId, onClose, onBlocked }: Props) {
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    if (busy) return
    setBusy(true)
    try {
      await api.blocks.create(userId)
      haptic.notification('success')
      onBlocked()
    } catch {
      setBusy(false)
      window.Telegram?.WebApp?.showAlert?.(t.errors.generic)
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="flex flex-col items-center text-center pb-2">
        <div className="w-14 h-14 rounded-m3-lg bg-error-container flex items-center justify-center mb-3.5">
          <Icon name="ban" size={26} className="text-error" />
        </div>
        <h2 className="text-[19px] font-semibold text-txt">{t.block.title(name)}</h2>
        <p className="mt-2.5 text-[13.5px] leading-[1.9] text-txt2">{t.block.body}</p>

        <Button
          onClick={confirm}
          disabled={busy}
          variant="destructive"
          block
          size="lg"
          className="mt-5"
        >
          {busy ? '…' : t.block.confirm(name)}
        </Button>
        <Button onClick={onClose} disabled={busy} variant="text" block className="mt-2">
          {t.block.cancel}
        </Button>
      </div>
    </Sheet>
  )
}
