import { useState } from 'react'
import { api } from '../api.js'
import { t } from '../i18n.js'
import { haptic } from '../telegram.js'

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="glass border border-white/15 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
        style={{ paddingBottom: 'calc(1.5rem + var(--tg-safe-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-extrabold text-white">{t.report.title}</h2>
          <button onClick={onClose} aria-label={t.report.cancel} className="text-white/50 text-2xl leading-none">✕</button>
        </div>

        <div className="space-y-2 mb-4">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                haptic.selection()
                setReason(r)
              }}
              className={`w-full text-left px-4 py-3 rounded-2xl border transition-colors ${
                reason === r
                  ? 'border-[#ec4067] bg-[#ec4067]/15 text-white'
                  : 'border-white/12 bg-white/5 text-white/80'
              }`}
            >
              {REASON_LABEL[r]}
            </button>
          ))}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder={t.report.notePlaceholder}
          rows={2}
          className="w-full rounded-2xl bg-white/5 border border-white/12 p-3 text-[14px] text-white placeholder:text-white/40 mb-4"
        />

        <button
          onClick={submit}
          disabled={!reason || busy}
          className="w-full py-3 rounded-2xl bg-rose-500 text-white font-bold mb-3 disabled:opacity-50"
        >
          {busy ? '…' : t.report.submit}
        </button>
        <button onClick={onClose} disabled={busy} className="w-full py-3 text-white/50 font-semibold">
          {t.report.cancel}
        </button>
      </div>
    </div>
  )
}
