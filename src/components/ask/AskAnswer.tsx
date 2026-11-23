// Screen 2 — a friend answers an ask (member via bot DM, or a link advisor).
// Shows the target's public profile (no like/message), three verdict buttons,
// an optional note, then a thanks state that stays editable for 10 minutes.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { t } from '../../i18n.js'
import { formatTime } from '../../i18n/format.js'
import { haptic, needsInPageBack } from '../../telegram.js'
import { Avatar, Button, Icon, IconButton, Textarea } from '../ui/index.js'
import type { IconName } from '../ui/index.js'
import type { AskRecipientView, AskVerdict } from '../../types.js'
import { ASK_NOTE_MAX, ASK_VERDICTS, errorBody, questionLabel, showToast, verdictLabel } from './askUtils.js'

const VERDICT_ICON: Record<AskVerdict, IconName> = { yes: 'check', unsure: 'help-circle', no: 'x' }

interface Props {
  view: AskRecipientView
  recipientKind: 'member' | 'link'
  onSubmit: (verdict: AskVerdict, note: string | undefined) => Promise<void>
  /** Header back arrow (outside Telegram) / leaving the screen. */
  onBack?: () => void
  /** Rendered under the thanks state (e.g. "try Luma yourself"). */
  thanksFooter?: ReactNode
  /** Analytics hook — fired once the answer is accepted. */
  onAnswered?: (verdict: AskVerdict, hasNote: boolean) => void
}

/** Faint repeated per-recipient code drawn over photos (screenshot deterrent). */
export function Watermark({ code }: { code: string }) {
  const cells = Array.from({ length: 24 })
  return (
    <div
      aria-hidden="true"
      data-testid="ask-watermark"
      className="absolute inset-0 overflow-hidden pointer-events-none select-none"
    >
      <div
        className="absolute grid grid-cols-4 gap-x-6 gap-y-10 text-white font-medium text-[13px] tracking-widest"
        style={{ inset: '-30%', transform: 'rotate(-24deg)', opacity: 0.16, textShadow: '0 0 2px rgba(0,0,0,.6)' }}
      >
        {cells.map((_, i) => <span key={i}>{code}</span>)}
      </div>
    </div>
  )
}

function PhotoCarousel({ photos, alt, watermark }: { photos: string[]; alt: string; watermark: string }) {
  const [idx, setIdx] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const onScroll = () => {
    const el = scroller.current
    if (!el || el.clientWidth === 0) return
    setIdx(Math.round(Math.abs(el.scrollLeft) / el.clientWidth))
  }
  if (photos.length === 0) {
    return <div className="w-full h-full bg-surface-high" />
  }
  return (
    <>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex w-full h-full overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none' }}
      >
        {photos.map((url) => (
          <div key={url} className="relative w-full h-full flex-none snap-center">
            <img src={url} alt={alt} className="w-full h-full object-cover pointer-events-none" draggable={false} />
            <Watermark code={watermark} />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <div className="absolute top-3 left-3 right-3 flex gap-1 pointer-events-none">
          {photos.map((_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i === idx ? 'bg-white' : 'bg-white/40'}`} />
          ))}
        </div>
      )}
    </>
  )
}

export function AskAnswer({ view, recipientKind, onSubmit, onBack, thanksFooter, onAnswered }: Props) {
  const [answer, setAnswer] = useState(view.myAnswer)
  const [editing, setEditing] = useState(!view.myAnswer)
  const [verdict, setVerdict] = useState<AskVerdict | null>(view.myAnswer?.verdict ?? null)
  const [note, setNote] = useState(view.myAnswer?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [closed, setClosed] = useState(view.status !== 'open')
  const [locked, setLocked] = useState(false)
  const [, setTick] = useState(0)

  // Re-render when the edit window closes so the edit button disappears.
  const editableUntil = answer ? Date.parse(answer.editableUntil) : 0
  useEffect(() => {
    if (!answer) return
    const ms = editableUntil - Date.now()
    if (ms <= 0) return
    const id = setTimeout(() => setTick((n) => n + 1), Math.min(ms + 50, 2_147_000_000))
    return () => clearTimeout(id)
  }, [answer, editableUntil])

  const canEdit = !!answer && !locked && !closed && Date.now() < editableUntil
  const { profile } = view
  const q = view.question

  const submit = async () => {
    if (!verdict || busy) return
    setBusy(true)
    const trimmed = note.trim().slice(0, ASK_NOTE_MAX)
    try {
      await onSubmit(verdict, trimmed || undefined)
      haptic.notification('success')
      const now = new Date()
      setAnswer({
        verdict,
        note: trimmed || null,
        answeredAt: answer?.answeredAt ?? now.toISOString(),
        editableUntil: answer?.editableUntil ?? new Date(now.getTime() + 10 * 60_000).toISOString(),
      })
      setEditing(false)
      onAnswered?.(verdict, !!trimmed)
    } catch (err) {
      haptic.notification('error')
      const body = errorBody(err)
      if (String(body.error).includes('ask_closed')) setClosed(true)
      else if (String(body.error).includes('answer_locked')) { setLocked(true); setEditing(false) }
      else showToast(t.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  const header = (
    <div className="flex items-center gap-2 h-12 px-2">
      {needsInPageBack() && onBack && (
        <IconButton icon="arrow-left" tone="ghost" iconSize={20} className="rtl:-scale-x-100" aria-label={t.aria.back} onClick={onBack} />
      )}
      <span className="text-[18px] font-medium text-txt px-2">{t.ask.answerHeader}</span>
    </div>
  )

  if (closed) {
    return (
      <div className="h-full flex flex-col bg-bg text-txt" style={{ paddingTop: 'var(--tg-safe-top)' }}>
        {header}
        <AskStateMessage icon="clock" title={t.ask.closed} />
      </div>
    )
  }

  if (answer && !editing) {
    return (
      <div className="h-full flex flex-col bg-bg text-txt" style={{ paddingTop: 'var(--tg-safe-top)' }}>
        {header}
        <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col items-center text-center gap-3 pt-10">
          <div className="w-16 h-16 rounded-m3-lg bg-primary-container text-on-primary-container flex items-center justify-center">
            <Icon name="check" size={30} />
          </div>
          <h1 className="text-[20px] font-medium">{t.ask.thanksTitle(view.requesterName)}</h1>
          <p className="text-[14px] text-txt2">{t.ask.thanksSub}</p>
          <div className="w-full mt-2 rounded-m3-md bg-surface p-4 text-start flex flex-col gap-1.5">
            <span className="text-[12px] text-txt2">{t.ask.yourAnswer}</span>
            <span className="text-[15px] font-medium text-txt">{verdictLabel(q, answer.verdict)}</span>
            {answer.note && <span className="text-[13px] text-txt2 whitespace-pre-wrap break-words">{answer.note}</span>}
          </div>
          {locked && <p className="text-[12px] text-txt3">{t.ask.answerLocked}</p>}
          {canEdit && (
            <>
              <Button variant="outlined" icon="pencil" onClick={() => { haptic.selection(); setEditing(true) }}>
                {t.ask.editAnswer}
              </Button>
              <p className="text-[12px] text-txt3">{t.ask.editUntil(formatTime(new Date(editableUntil)))}</p>
            </>
          )}
          {thanksFooter && <div className="w-full mt-4">{thanksFooter}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-bg text-txt" style={{ paddingTop: 'var(--tg-safe-top)' }}>
      {header}
      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-3.5">
        {/* Requester + question */}
        <div className="flex items-center gap-3">
          <Avatar src={view.requesterPhotoUrl} size={40} alt={view.requesterName} />
          <span className="flex flex-col min-w-0">
            <span className="text-[15px] font-medium">{t.ask.wantsYourOpinion(view.requesterName)}</span>
            <span className="text-[13px] text-txt2">{t.ask.asksQuestion(questionLabel(q))}</span>
          </span>
        </div>

        {/* Profile card */}
        <div className="relative w-full aspect-[4/5] max-h-[440px] rounded-m3-xl overflow-hidden bg-surface-high shadow-m3-1 select-none">
          <PhotoCarousel photos={profile.photos} alt={profile.name} watermark={view.watermark} />
          {profile.verified && (
            <div
              className="absolute top-7 start-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] text-white pointer-events-none"
              style={{ background: 'rgba(0,0,0,.35)' }}
            >
              <Icon name="verified" size={14} />
              {t.ask.verified}
            </div>
          )}
          <div
            className="absolute inset-x-0 bottom-0 p-4 flex flex-col gap-1.5 text-white pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,.72), rgba(0,0,0,0))' }}
          >
            <div className="flex items-baseline gap-2 leading-none">
              <span className="text-[26px] font-medium">{profile.name}</span>
              <span className="text-[22px] text-white/90">{profile.age}</span>
            </div>
            {profile.location && <div className="text-[13px] opacity-90">{profile.location}</div>}
            {profile.interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {profile.interests.slice(0, 6).map((tag) => (
                  <span key={tag} className="rounded-m3-sm px-2 py-0.5 text-[12px]" style={{ background: 'rgba(0,0,0,.35)' }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {profile.bio && (
          <div className="rounded-m3-md bg-surface px-4 py-3 text-[14px] leading-relaxed text-txt whitespace-pre-wrap break-words">
            <span className="text-txt2">{t.ask.bioLabel}: </span>«{profile.bio}»
          </div>
        )}

        {/* Verdicts */}
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {ASK_VERDICTS.map((v) => {
            const on = verdict === v
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => { haptic.selection(); setVerdict(v) }}
                className={[
                  'flex flex-col items-center justify-center gap-1 min-h-[64px] rounded-m3-md px-2 text-[13px] font-medium transition-colors',
                  on
                    ? v === 'no'
                      ? 'bg-error-container text-error'
                      : 'bg-primary-container text-on-primary-container'
                    : 'bg-surface text-txt2 border border-outline',
                ].join(' ')}
              >
                <Icon name={VERDICT_ICON[v]} size={20} />
                {verdictLabel(q, v)}
              </button>
            )
          })}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-txt2">{t.ask.noteLabel}</span>
          <Textarea
            rows={3}
            maxLength={ASK_NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, ASK_NOTE_MAX))}
            placeholder={t.ask.notePlaceholder}
          />
          <span className="text-[11px] text-txt3 self-end" dir="ltr">{note.length}/{ASK_NOTE_MAX}</span>
        </label>

        <p className="text-[12px] text-txt2 text-center">{t.ask.answerPrivacy(view.requesterName, profile.name)}</p>
      </div>
      <div className="px-4 pt-2" style={{ paddingBottom: 'calc(12px + var(--tg-safe-bottom))' }}>
        <Button block size="lg" onClick={submit} disabled={!verdict || busy} data-kind={recipientKind}>
          {t.ask.sendAnswer}
        </Button>
      </div>
    </div>
  )
}

/** Centered icon + message used by the terminal states (closed, taken, …). */
export function AskStateMessage({ icon, title, sub, children }: { icon: IconName; title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
      <div className="w-16 h-16 rounded-m3-lg bg-surface text-txt2 flex items-center justify-center">
        <Icon name={icon} size={28} />
      </div>
      <h1 className="text-[18px] font-medium text-txt">{title}</h1>
      {sub && <p className="text-[14px] text-txt2">{sub}</p>}
      {children}
    </div>
  )
}
