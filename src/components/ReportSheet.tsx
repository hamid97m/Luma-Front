import { useState } from 'react'
import { api } from '../api.js'
import { t } from '../i18n.js'
import { haptic } from '../telegram.js'
import { Button, Icon, Sheet, Textarea } from './ui'

const REASONS = ['fake', 'inappropriate', 'harassment', 'spam', 'other'] as const
type Reason = (typeof REASONS)[number]

const REASON_LABEL: Record<Reason, string> = {
  fake: t.report.reasonFake,
  inappropriate: t.report.reasonInappropriate,
  harassment: t.report.reasonHarassment,
  spam: t.report.reasonSpam,
  other: t.report.reasonOther,
}

interface Props {
  reportedUserId: string
  context: 'discovery' | 'chat'
  matchId?: string
  onClose: () => void
  onSubmitted: () => void
}

export function ReportSheet({ reportedUserId, context, matchId, onClose, onSubmitted }: Props) {
  const [reason, setReason] = useState<Reason | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!reason || busy) return
    setBusy(true)
    try {
      await api.reports.create({
        reportedUserId,
        context,
        reason,
        note: note.trim() || undefined,
        matchId,
      })
      haptic.notification('success')
      onSubmitted()
    } catch {
      setBusy(false)
      window.Telegram?.WebApp?.showAlert?.(t.errors.generic)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          <Icon name="flag" size={20} className="text-error" />
          {t.report.title}
        </span>
      }
    >
      <div className="flex flex-col gap-2 mb-3.5">
        {REASONS.map((r) => {
          const selected = reason === r
          return (
            <button
              key={r}
              type="button"
              onClick={() => {
                haptic.selection()
                setReason(r)
              }}
              className={`w-full flex items-center justify-between gap-2 text-start px-4 py-3 rounded-m3-md transition-colors ${
                selected
                  ? 'bg-primary-container text-on-primary-container'
                  : 'bg-surface text-txt2'
              }`}
            >
              <span className="text-[14px]">{REASON_LABEL[r]}</span>
              {selected && <Icon name="check" size={18} className="flex-none" />}
            </button>
          )
        })}
      </div>

      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder={t.report.notePlaceholder}
        rows={2}
        className="mb-3.5"
      />

      <Button
        onClick={submit}
        disabled={!reason || busy}
        variant="destructive"
        block
        size="lg"
        className="mb-2"
      >
        {busy ? '…' : t.report.submit}
      </Button>
      <Button onClick={onClose} disabled={busy} variant="text" block>
        {t.report.cancel}
      </Button>
    </Sheet>
  )
}
