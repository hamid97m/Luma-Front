import { useState } from 'react'
import { t } from '../../i18n.js'
import { Button, Sheet, Textarea } from '../ui/index.js'

/** Same cap as the server's. */
const MAX_LENGTH = 500

interface Props {
  recipientName: string
  /** Requests left today; null when the sender isn't on a quota. */
  remaining: number | null
  sending: boolean
  error: string | null
  onClose: () => void
  onSend: (text: string) => void
}

/** Write the opener of a message request — the recipient decides whether a chat opens. */
export function MessageRequestSheet({ recipientName, remaining, sending, error, onClose, onSend }: Props) {
  const [text, setText] = useState('')
  const body = text.trim()

  return (
    <Sheet open onClose={() => { if (!sending) onClose() }} title={t.requests.composeTitle(recipientName)}>
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-[14px] text-txt2 leading-relaxed">{t.requests.composeBody}</p>
        <div>
          <Textarea
            autoFocus
            dir="auto"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_LENGTH}
            rows={4}
            placeholder={t.requests.composePlaceholder}
          />
          <div className="flex items-center justify-between gap-3 px-1 pt-1 text-[12px] text-txt3">
            <span>{remaining != null && t.directChat.remaining(remaining)}</span>
            <span dir="ltr" className="tabular-nums flex-none">{text.length}/{MAX_LENGTH}</span>
          </div>
        </div>
        {error && <p role="alert" className="text-[13px] text-error">{error}</p>}
        <Button variant="filled" onClick={() => onSend(body)} disabled={!body || sending} className="w-full">
          {t.requests.send}
        </Button>
      </div>
    </Sheet>
  )
}
