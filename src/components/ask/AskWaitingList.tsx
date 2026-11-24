// «منتظر نظر» — profiles she set aside from Discovery while friends weigh in
// (Likes tab, women with "ask a friend"). Tap a card → results; ✕ / ♥ decide here.
import { useEffect, useState } from 'react'
import { api } from '../../api.js'
import { t } from '../../i18n.js'
import { relativeTime } from '../../i18n/format.js'
import { haptic } from '../../telegram.js'
import { Icon } from '../ui/index.js'
import type { AskDetail, AskRecipient, AskSummary, SwipeResult } from '../../types.js'
import { showToast, useMyAsksStore, verdictLabel } from './askUtils.js'

const EXPIRING_MS = 12 * 60 * 60 * 1000

interface Props {
  onOpenResults: (askId: string) => void
  onMatch: (match: NonNullable<SwipeResult['match']>) => void
}

const initial = (r: AskRecipient) => (r.displayName ?? t.ask.unnamedFriend).trim().charAt(0)
const friendName = (r: AskRecipient) => r.displayName ?? t.ask.unnamedFriend

export function AskWaitingList({ onOpenResults, onMatch }: Props) {
  const asks = useMyAsksStore((s) => s.asks)
  const [details, setDetails] = useState<Record<string, AskDetail>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [reminded, setReminded] = useState<Set<string>>(new Set())

  useEffect(() => { useMyAsksStore.getState().load() }, [])

  // Recipients/notes per ask (at most a handful are open at once).
  const idsKey = asks.map((a) => a.id).join(',')
  useEffect(() => {
    let alive = true
    Promise.all(asks.map((a) => api.asks.get(a.id).catch(() => null))).then((list) => {
      if (!alive) return
      const next: Record<string, AskDetail> = {}
      for (const d of list) if (d) next[d.id] = d
      setDetails(next)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const decide = async (a: AskSummary, direction: 'like' | 'pass') => {
    if (busy) return
    haptic.impact(direction === 'like' ? 'medium' : 'light')
    setBusy(a.id)
    try {
      const res = await api.swipes.swipe(a.targetId, direction)
      useMyAsksStore.getState().remove(a.id)
      if (res.matched && res.match) onMatch(res.match)
    } catch {
      haptic.notification('error')
      showToast(t.errors.generic)
    } finally {
      setBusy(null)
    }
  }

  const remind = async (a: AskSummary, r: AskRecipient) => {
    haptic.selection()
    setReminded((s) => new Set(s).add(r.id))
    try { await api.asks.remind(a.id, r.id) } catch { /* button already shows sent */ }
  }

  if (asks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-10 pb-12">
        <div className="w-[76px] h-[76px] rounded-full bg-surface flex items-center justify-center mb-1.5">
          <Icon name="users" size={30} className="text-primary" />
        </div>
        <h2 className="text-[20px] font-medium text-txt">{t.ask.waitingEmpty}</h2>
        <p className="text-txt2 text-[14px] leading-relaxed max-w-[260px]">{t.ask.waitingEmptySub}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-4" data-testid="ask-waiting-list">
      <p className="text-[12px] text-txt2 px-1">{t.ask.waitingSub}</p>
      {asks.map((a) => {
        const d = details[a.id]
        const recipients = d?.recipients ?? []
        const answered = recipients
          .filter((r) => r.status === 'answered' && r.verdict)
          .sort((x, y) => Date.parse(y.answeredAt ?? '') - Date.parse(x.answeredAt ?? ''))
        const pending = recipients.filter((r) => !(r.status === 'answered' && r.verdict))
        const left = Date.parse(a.expiresAt) - Date.now()
        const expiring = left > 0 && left < EXPIRING_MS
        const latest = answered[0]
        const firstPending = pending[0]
        const age = d?.target?.age

        const chip = expiring
          ? { text: t.ask.hoursLeft(Math.max(1, Math.ceil(left / 3_600_000))), cls: 'bg-error-container text-error' }
          : a.answered > 0
            ? { text: t.ask.badgeTally(a.yes, a.total, verdictLabel(a.question, 'yes')), cls: 'bg-primary-container text-on-primary-container' }
            : { text: t.ask.waitingFor(a.total - a.answered), cls: 'bg-bg border border-outline text-txt2' }

        const subtitle = latest
          ? latest.note
            ? `${friendName(latest)}: «${latest.note}» · ${relativeTime(latest.answeredAt ?? a.createdAt)}`
            : `${friendName(latest)}: ${verdictLabel(a.question, latest.verdict!)} · ${relativeTime(latest.answeredAt ?? a.createdAt)}`
          : firstPending
            ? `${firstPending.status === 'seen' ? t.ask.seenNotAnswered(friendName(firstPending)) : t.ask.notOpenedYet} · ${relativeTime(a.createdAt)}`
            : relativeTime(a.createdAt)

        const remindable = answered.length === 0 ? pending.find((r) => r.canRemind && !reminded.has(r.id)) : undefined

        return (
          <div
            key={a.id}
            role="button"
            tabIndex={0}
            onClick={() => { haptic.selection(); onOpenResults(a.id) }}
            data-testid="ask-waiting-item"
            className="flex flex-col gap-2.5 p-3 rounded-[20px] bg-surface text-txt cursor-pointer"
          >
            <div className="flex items-center gap-3">
              {a.targetPhotoUrl ? (
                <img src={a.targetPhotoUrl} alt={a.targetName} className="w-14 h-14 rounded-m3-md object-cover flex-none" />
              ) : (
                <span className="w-14 h-14 rounded-m3-md flex-none" style={{ background: 'linear-gradient(160deg, var(--sch), var(--ol))' }} />
              )}
              <span className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  <span className="text-[16px] font-medium truncate">{age ? `${a.targetName}، ${age}` : a.targetName}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${chip.cls}`}>{chip.text}</span>
                </span>
                <span className="text-[12px] text-txt2 truncate">{subtitle}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex-1 flex items-center gap-1 min-w-0">
                {recipients.map((r) => {
                  const done = r.status === 'answered' && r.verdict
                  return (
                    <span
                      key={r.id}
                      className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-medium flex-none ${
                        done
                          ? r.verdict === 'yes' ? 'bg-primary text-white' : 'text-white'
                          : 'bg-surface-high text-txt2 border border-dashed border-outline-variant'
                      }`}
                      style={done && r.verdict !== 'yes' ? { background: 'var(--ol2)' } : undefined}
                      title={friendName(r)}
                    >
                      {initial(r)}
                    </span>
                  )
                })}
                {answered.length > 0 && firstPending && (
                  <span className="text-[11px] text-txt2 ms-1 truncate">{t.ask.notYet(friendName(firstPending))}</span>
                )}
                {remindable && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); remind(a, remindable) }}
                    className="h-7 px-2.5 rounded-full text-[12px] font-medium text-primary"
                  >
                    {t.ask.remind}
                  </button>
                )}
              </span>
              <button
                type="button"
                aria-label={t.aria.pass}
                disabled={busy === a.id}
                onClick={(e) => { e.stopPropagation(); decide(a, 'pass') }}
                className="w-11 h-11 rounded-full border border-outline bg-bg text-txt2 flex items-center justify-center flex-none disabled:opacity-40"
              >
                <Icon name="x" size={20} strokeWidth={2} />
              </button>
              <button
                type="button"
                aria-label={t.aria.like}
                disabled={busy === a.id}
                onClick={(e) => { e.stopPropagation(); decide(a, 'like') }}
                className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center flex-none disabled:opacity-40"
              >
                <Icon name="heart" size={20} filled />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
