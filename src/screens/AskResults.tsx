// Screen 4 — the requester's results for one ask: tally, each friend's answer,
// pending friends (with a one-time reminder), and the decision footer.
// Reached from the discovery card badge or WEB_URL?screen=ask_result&id=<askId>.
import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { t } from '../i18n.js'
import { relativeTime } from '../i18n/format.js'
import { haptic, needsInPageBack, useBackButton } from '../telegram.js'
import { Avatar, Button, Icon, IconButton } from '../components/ui/index.js'
import { AskStateMessage } from '../components/ask/AskAnswer.js'
import { ASK_VERDICTS, errorBody, showToast, trackAsk, verdictLabel } from '../components/ask/askUtils.js'
import type { AskDetail, AskRecipient, AskVerdict } from '../types.js'

interface Props {
  askId: string
  onClose: () => void
  /** "Reply to <name>" — back to that card in Discovery. */
  onReply: (detail: AskDetail) => void
  /** ✕ — pass on that person. */
  onPass: (detail: AskDetail) => void
}

const VERDICT_TONE: Record<AskVerdict, string> = {
  yes: 'bg-primary-container text-on-primary-container',
  unsure: 'bg-surface-high text-txt2',
  no: 'bg-error-container text-error',
}

export function AskResults({ askId, onClose, onReply, onPass }: Props) {
  const [detail, setDetail] = useState<AskDetail | null>(null)
  const [failed, setFailed] = useState<false | 'gone' | 'error'>(false)
  const [attempt, setAttempt] = useState(0)
  const [reminded, setReminded] = useState<Set<string>>(new Set())
  const [reminding, setReminding] = useState<string | null>(null)
  const viewed = useRef(false)
  useBackButton(true, onClose)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const d = await api.asks.get(askId)
        if (!alive) return
        setDetail(d)
        if (!viewed.current) {
          viewed.current = true
          trackAsk({ name: 'ask_result_viewed', requestId: d.id, props: { answers_count: d.answered } })
        }
      } catch (err) {
        // Only a 404 means the ask is gone; anything else (network, 5xx) can be retried.
        if (alive) setFailed(errorBody(err).status === 404 ? 'gone' : 'error')
      }
    })()
    return () => { alive = false }
  }, [askId, attempt])

  const remind = async (r: AskRecipient) => {
    if (reminding) return
    haptic.selection()
    setReminding(r.id)
    try {
      await api.asks.remind(askId, r.id)
      haptic.notification('success')
      setReminded((s) => new Set(s).add(r.id))
    } catch (err) {
      haptic.notification('error')
      const { error } = errorBody(err)
      if (String(error).includes('cannot_remind')) setReminded((s) => new Set(s).add(r.id))
      showToast(t.errors.generic)
    } finally {
      setReminding(null)
    }
  }

  const header = (title: string) => (
    <div className="flex items-center gap-1 h-12 px-2 flex-none">
      {needsInPageBack() && (
        <IconButton icon="arrow-left" tone="ghost" iconSize={20} className="rtl:-scale-x-100" aria-label={t.aria.back} onClick={onClose} />
      )}
      <span className="text-[18px] font-medium text-txt px-2 truncate">{title}</span>
    </div>
  )

  const wrap = (node: React.ReactNode) => (
    <div className="fixed inset-0 z-40 bg-bg text-txt flex flex-col" style={{ paddingTop: 'var(--tg-safe-top)' }} data-testid="ask-results">
      {node}
    </div>
  )

  if (failed) {
    return wrap(
      <>
        {header('')}
        <AskStateMessage icon={failed === 'gone' ? 'clock' : 'alert-triangle'} title={failed === 'gone' ? t.ask.closed : t.errors.generic}>
          {failed === 'error' && (
            <Button onClick={() => { setFailed(false); setAttempt((n) => n + 1) }}>{t.errors.retry}</Button>
          )}
          <Button variant="tonal" onClick={onClose}>{t.ask.close}</Button>
        </AskStateMessage>
      </>,
    )
  }

  if (!detail) {
    return wrap(
      <div className="flex-1 flex items-center justify-center">
        <img src="/luma-icon.png" alt="" className="w-14 h-14 rounded-m3-lg animate-pulse-heart select-none" />
      </div>,
    )
  }

  const q = detail.question
  const name = detail.target?.name ?? detail.targetName
  const photo = detail.target?.photoUrl ?? detail.targetPhotoUrl
  const answered = detail.recipients.filter((r) => r.status === 'answered' && r.verdict)
  const pending = detail.recipients.filter((r) => !(r.status === 'answered' && r.verdict))
  const counts: Record<AskVerdict, number> = { yes: detail.yes, unsure: detail.unsure, no: detail.no }
  const open = detail.status === 'open'

  const decide = (decision: 'like' | 'pass') => {
    // ask_requester_decision is recorded server-side when the swipe closes the ask.
    if (decision === 'like') onReply(detail)
    else onPass(detail)
  }

  return wrap(
    <>
      {header(t.ask.resultsTitle(name))}
      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-3.5">
        {/* Compact profile row */}
        <div className="flex items-center gap-3 rounded-m3-md bg-surface p-3">
          <Avatar src={photo} size={48} alt={name} />
          <span className="flex-1 flex flex-col min-w-0">
            <span className="text-[15px] font-medium truncate">
              {name}{detail.target?.age ? <span className="text-txt2 font-normal"> {detail.target.age}</span> : null}
            </span>
            <span className="text-[12px] text-txt2">{t.ask.askedAgo(relativeTime(detail.createdAt))}</span>
          </span>
          {detail.answered > 0 && (
            <span className="text-[12px] font-medium rounded-full px-2.5 py-1 bg-primary-container text-on-primary-container flex-none" data-testid="ask-results-badge">
              {t.ask.badgeTally(detail.yes, detail.total, verdictLabel(q, 'yes'))}
            </span>
          )}
        </div>

        {/* Tally */}
        <div className="grid grid-cols-3 gap-2">
          {ASK_VERDICTS.map((v) => (
            <div key={v} className="flex flex-col items-center gap-0.5 rounded-m3-md bg-surface py-3 px-1" data-testid={`ask-tally-${v}`}>
              <span className="text-[22px] font-medium text-txt">{counts[v]}</span>
              <span className="text-[12px] text-txt2 text-center">{verdictLabel(q, v)}</span>
            </div>
          ))}
        </div>

        {!open && <p className="text-[13px] text-txt2 text-center">{t.ask.closedNote}</p>}
        {answered.length === 0 && <p className="text-[13px] text-txt3 text-center">{t.ask.noAnswersYet}</p>}

        {/* Answers + pending */}
        <div className="flex flex-col gap-2">
          {answered.map((r) => {
            const label = r.displayName ?? t.ask.unnamedFriend
            return (
              <div key={r.id} className="flex gap-3 rounded-m3-md bg-surface p-3" data-testid="ask-answer-card">
                <span className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[14px] font-medium flex-none">
                  {label.charAt(0)}
                </span>
                <span className="flex-1 flex flex-col gap-1 min-w-0">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-medium">{label}</span>
                    <span className={`text-[12px] font-medium rounded-full px-2 py-0.5 ${VERDICT_TONE[r.verdict!]}`}>{verdictLabel(q, r.verdict!)}</span>
                  </span>
                  {r.note && <span className="text-[13px] text-txt whitespace-pre-wrap break-words">{r.note}</span>}
                  {r.answeredAt && <span className="text-[11px] text-txt3">{relativeTime(r.answeredAt)}</span>}
                  {r.foreignOpen && <ForeignOpen />}
                </span>
              </div>
            )
          })}
          {pending.map((r) => {
            const label = r.displayName ?? t.ask.unnamedFriend
            const done = reminded.has(r.id)
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-m3-md bg-surface p-3" data-testid="ask-pending-card">
                <span className="w-9 h-9 rounded-full bg-surface-high text-txt2 flex items-center justify-center text-[14px] font-medium flex-none">
                  {r.displayName ? label.charAt(0) : <Icon name="link" size={16} />}
                </span>
                <span className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[14px] font-medium">{label}</span>
                  <span className="text-[12px] text-txt2">{r.status === 'seen' ? t.ask.pendingSeen : t.ask.pendingUnseen}</span>
                  {r.foreignOpen && <ForeignOpen />}
                </span>
                {open && (
                  <Button
                    size="sm"
                    variant="tonal"
                    disabled={!r.canRemind || done || reminding === r.id}
                    onClick={() => remind(r)}
                  >
                    {done ? t.ask.reminded : t.ask.remind}
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-[12px] text-txt2 text-center">{t.ask.resultsPrivacy(name)}</p>
      </div>

      {open && (
        <div className="flex items-center gap-3 px-4 pt-2" style={{ paddingBottom: 'calc(12px + var(--tg-safe-bottom))' }}>
          <Button block size="lg" className="flex-1" onClick={() => decide('like')}>{t.ask.replyCta(name)}</Button>
          <button
            type="button"
            onClick={() => decide('pass')}
            aria-label={t.ask.passAria}
            className="w-14 h-14 rounded-full bg-surface text-txt2 border border-outline flex items-center justify-center flex-none"
          >
            <Icon name="x" size={22} />
          </button>
        </div>
      )}
    </>,
  )
}

function ForeignOpen() {
  return (
    <span className="flex items-center gap-1 text-[11px] text-error">
      <Icon name="alert-triangle" size={12} />
      {t.ask.foreignOpen}
    </span>
  )
}
