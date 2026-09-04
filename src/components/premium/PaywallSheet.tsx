import { useEffect, useRef, useState } from 'react'
import { api } from '../../api.js'
import { t } from '../../i18n.js'
import { openInvoice, haptic } from '../../telegram.js'
import { usePremiumStore } from '../../store.js'
import { formatCountdown } from '../../utils/premium.js'
import { Icon, Sheet } from '../ui'
import { HowToBuyStars } from './HowToBuyStars.js'

interface PaywallSheetProps {
  open: boolean
  onClose: () => void
  /** Context-specific pitch line; defaults to the chat-gate subtitle. */
  subtitle?: string
}

type Phase = 'idle' | 'activating' | 'refunded' | 'error'

const POLL_INTERVAL_MS = 1500
const POLL_MAX_TRIES = 8

export function PaywallSheet({ open, onClose, subtitle }: PaywallSheetProps) {
  const status = usePremiumStore((s) => s.status)
  const plans = status?.plans ?? []
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [showHowTo, setShowHowTo] = useState(false)
  const [showOtherWays, setShowOtherWays] = useState(false)

  const mountedRef = useRef(true)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollTriesRef = useRef(0)
  // Same session-guard pattern as GiftPickerSheet: async continuations bail
  // when the sheet was closed/reopened after they started.
  const sessionRef = useRef(0)
  // Guards the "countdown crossed zero" refresh so it fires once per discount
  // target (`${plan.id}:${plan.discountEndsAt}`), not once per plans-array
  // identity. store.refresh() always produces a new array, so keying on
  // array identity would re-arm the guard on every refresh even when the
  // refetched data still shows the same expired discount (client clock
  // ahead of server, or the server hasn't cleared it yet) — that caused an
  // unthrottled refresh loop. A key only becomes eligible again if the
  // plan's discountEndsAt genuinely changes (new discount window) or the
  // sheet is reopened.
  const expiredRefreshFiredKeysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const clearPolling = () => {
    if (pollTimerRef.current != null) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  useEffect(() => {
    if (!open) { clearPolling(); return }
    sessionRef.current += 1
    setSelectedId(null)
    setPhase('idle')
    setBusy(false)
    setShowHowTo(false)
    setShowOtherWays(false)
    setNow(Date.now())
    expiredRefreshFiredKeysRef.current = new Set()
    usePremiumStore.getState().refresh()
    return () => { clearPolling() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // One shared 1-second interval for the whole sheet (not one per card) —
  // only runs while a discounted plan with an end time is actually shown.
  useEffect(() => {
    if (!open) return
    const hasCountdown = plans.some((p) => p.discountPercent != null && p.discountEndsAt)
    if (!hasCountdown) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [open, plans])

  // When a shown countdown crosses zero, refresh once per discount target so
  // prices/badges pick up the server's post-expiry values. Keyed (not
  // array-identity-guarded) so a refetch that still shows the same expired
  // discount doesn't re-fire the refresh on the next tick.
  useEffect(() => {
    if (!open) return
    const firedKeys = expiredRefreshFiredKeysRef.current
    const newlyExpired = plans.filter((p) => {
      if (p.discountPercent == null || !p.discountEndsAt) return false
      if (new Date(p.discountEndsAt).getTime() - now > 0) return false
      const key = `${p.id}:${p.discountEndsAt}`
      return !firedKeys.has(key)
    })
    if (newlyExpired.length > 0) {
      for (const p of newlyExpired) firedKeys.add(`${p.id}:${p.discountEndsAt}`)
      usePremiumStore.getState().refresh()
    }
  }, [now, open, plans])

  // Design: the best-value plan (cheapest per week) carries a badge and comes
  // preselected when the sheet opens. Plans arrive async via store.refresh(),
  // so preselect as soon as they're available rather than in the open effect.
  const perWeekOf = (p: { priceStars: number; durationDays: number }) =>
    p.priceStars / (Math.max(1, p.durationDays) / 7)
  const bestValueId =
    plans.length > 1 ? plans.reduce((a, b) => (perWeekOf(b) < perWeekOf(a) ? b : a)).id : null

  useEffect(() => {
    if (!open || selectedId != null || plans.length === 0) return
    setSelectedId(bestValueId ?? plans[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plans, selectedId])

  if (!open) return null

  const handleClose = () => {
    clearPolling()
    sessionRef.current += 1
    onClose()
  }

  const startPolling = (transactionId: string, session: number) => {
    clearPolling()
    pollTriesRef.current = 0
    pollTimerRef.current = setInterval(async () => {
      if (!mountedRef.current || session !== sessionRef.current) { clearPolling(); return }
      pollTriesRef.current += 1
      try {
        const res = await api.premium.transaction(transactionId)
        if (!mountedRef.current || session !== sessionRef.current) { clearPolling(); return }
        if (res.status === 'paid') {
          clearPolling()
          await usePremiumStore.getState().refresh()
          if (!mountedRef.current || session !== sessionRef.current) return
          haptic.notification('success')
          handleClose()
          return
        }
        if (res.status === 'refunded') {
          clearPolling()
          setPhase('refunded')
          return
        }
      } catch {
        // transient poll failure — counts toward the try budget below
      }
      if (pollTriesRef.current >= POLL_MAX_TRIES && pollTimerRef.current != null) {
        clearPolling()
        if (mountedRef.current && session === sessionRef.current) setPhase('error')
      }
    }, POLL_INTERVAL_MS)
  }

  const handleBuy = async () => {
    const plan = plans.find((p) => p.id === selectedId)
    if (!plan || busy) return
    const session = sessionRef.current
    haptic.impact('medium')
    setBusy(true)
    setPhase('idle')
    try {
      const { transactionId, invoiceLink } = await api.premium.checkout(plan.id)
      if (!mountedRef.current || session !== sessionRef.current) return
      const result = await openInvoice(invoiceLink)
      if (!mountedRef.current || session !== sessionRef.current) return
      if (result === 'paid') {
        setPhase('activating')
        startPolling(transactionId, session)
      } else if (result === 'cancelled') {
        // keep the sheet open — the user may pick another plan
      } else {
        setPhase('error')
      }
    } catch {
      if (mountedRef.current && session === sessionRef.current) setPhase('error')
    } finally {
      if (mountedRef.current && session === sessionRef.current) setBusy(false)
    }
  }

  const selected = plans.find((p) => p.id === selectedId) ?? null

  const benefits = [
    { icon: 'heart', label: t.premium.benefitSwipes },
    { icon: 'message', label: t.premium.benefitChat },
    { icon: 'eye', label: t.premium.benefitLikes },
  ] as const

  return (
    <>
    <Sheet
      open
      onClose={handleClose}
      title={
        <span className="flex items-center gap-2 text-[22px]">
          <Icon name="sparkle" size={20} className="text-gold" />
          {t.premium.title}
        </span>
      }
    >
      <p className="text-txt2 text-[14px] mb-3.5 -mt-1">{subtitle ?? t.premium.subtitle}</p>

      {phase === 'refunded' && <p className="text-error text-[14px] mb-4">{t.premium.refunded}</p>}
      {phase === 'error' && <p className="text-error text-[14px] mb-4">{t.premium.error}</p>}

      <div className="grid grid-cols-3 gap-2 mb-4">
        {benefits.map((b) => (
          <div
            key={b.icon}
            className="bg-surface rounded-m3-md px-2 py-2.5 flex flex-col items-center gap-1.5 text-center"
          >
            <Icon name={b.icon} size={18} className="text-primary" />
            <span className="text-[11px] font-medium leading-tight text-txt">{b.label}</span>
          </div>
        ))}
      </div>

      {phase === 'activating' ? (
        <div className="flex flex-col items-center justify-center py-10">
          <div
            className="w-7 h-7 border-[3px] border-primary-container border-t-primary rounded-full mb-3"
            style={{ animation: 'lumaSpin .8s linear infinite' }}
          />
          <p className="text-txt2 text-[14px]">{t.premium.activating}</p>
        </div>
      ) : plans.length === 0 ? (
        <p className="text-txt2 text-[14px] text-center py-10">{t.premium.noPlans}</p>
      ) : (
        <>
          <div className="flex flex-col gap-2 mb-3.5">
            {plans.map((plan) => {
              const isSelected = plan.id === selectedId
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => { if (!busy) { haptic.selection(); setSelectedId(plan.id) } }}
                  disabled={busy}
                  className={`text-start rounded-m3-md px-4 py-3.5 border-2 transition-colors disabled:opacity-50 ${
                    isSelected ? 'border-primary bg-primary-container' : 'border-transparent bg-surface'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[15px] text-txt flex items-center gap-2">
                      {plan.title}
                      {plan.id === bestValueId && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full text-primary"
                          style={{ background: 'var(--prtint)' }}
                        >
                          {t.premium.bestValue}
                        </span>
                      )}
                    </span>
                    {plan.discountPercent != null && (
                      <span dir="ltr" className="bg-primary text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                        -{plan.discountPercent}%
                      </span>
                    )}
                  </div>
                  {plan.description && (
                    <div className="text-[12px] text-txt2 mt-0.5">{plan.description}</div>
                  )}
                  <div className="flex items-baseline gap-2 mt-2">
                    {plan.originalPriceStars != null && (
                      <span className="text-[13px] line-through text-txt3 inline-flex items-center gap-0.5">
                        <Icon name="star" size={12} className="text-primary" />{plan.originalPriceStars}
                      </span>
                    )}
                    <span className="font-bold text-[16px] text-txt inline-flex items-center gap-1">
                      <Icon name="star" size={15} className="text-primary" />{plan.priceStars}
                    </span>
                    <span className="text-[12px] text-txt2">· {t.premium.days(plan.durationDays)}</span>
                    <span className="ms-auto text-[12px] text-txt2">
                      {t.premium.perWeek(Math.round(perWeekOf(plan)))}
                    </span>
                  </div>
                  {plan.discountPercent != null && plan.discountEndsAt && (
                    <div className="flex items-center gap-1.5 mt-2 text-primary text-[11px] font-bold">
                      <Icon name="clock" size={12} />
                      {t.premium.endsIn(formatCountdown(new Date(plan.discountEndsAt).getTime() - now))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={handleBuy}
            disabled={!selected || busy}
            className="w-full h-12 rounded-full bg-gold-btn text-[#241A00] font-medium text-[15px] flex items-center justify-center transition-opacity disabled:opacity-45"
          >
            {busy ? (
              <span
                className="w-5 h-5 border-2 border-[#241A00] border-t-transparent rounded-full"
                style={{ animation: 'lumaSpin .8s linear infinite' }}
              />
            ) : selected ? (
              t.premium.buy(selected.priceStars)
            ) : (
              t.premium.selectPrompt
            )}
          </button>

          {/* Prominent "don't have Stars?" CTA → opens the full 3-step guide. */}
          <button
            type="button"
            dir="rtl"
            onClick={() => { haptic.selection(); setShowHowTo(true) }}
            className="w-full mt-2.5 flex flex-col gap-0.5 text-start rounded-m3-md border-[1.5px] border-primary px-3.5 py-3 transition-colors"
            style={{ background: 'var(--prtint)' }}
          >
            <span className="flex items-center gap-2 w-full">
              <Icon name="sparkle" size={16} className="text-primary flex-none" />
              <span className="flex-1 min-w-0 text-[14px] font-bold text-primary">
                {t.premium.starsGuideCta}
              </span>
              <Icon name="chevron-left" size={15} className="text-primary flex-none" />
            </span>
            <span className="text-[12px] leading-relaxed text-txt2 pe-6">
              {t.premium.starsGuideCtaHint}
            </span>
          </button>

          <div className="flex items-center justify-center gap-1.5 mt-3">
            <Icon name="lock" size={13} className="text-txt3" />
            <span className="text-[12px] text-txt3">{t.premium.payHint}</span>
          </div>
          <p className="text-center text-[12px] text-txt2 mt-2.5 mb-0">{t.premium.socialProof}</p>

          {/* Secondary collapsible — alternative ways to get Stars. */}
          <button
            type="button"
            onClick={() => { haptic.selection(); setShowOtherWays((v) => !v) }}
            className="w-full mt-3.5 flex items-center justify-center gap-1.5 text-primary text-[13px] font-medium py-2"
          >
            <Icon name="help-circle" size={14} className="flex-none" />
            {t.premium.otherWaysToggle}
            <Icon
              name="chevron-down"
              size={14}
              className={`flex-none transition-transform ${showOtherWays ? 'rotate-180' : ''}`}
            />
          </button>
          {showOtherWays && (
            <div dir="rtl" className="bg-surface rounded-m3-lg p-4 mt-1 flex flex-col gap-3.5">
              <p className="m-0 text-[11px] font-semibold tracking-wide uppercase text-txt3">
                {t.premium.otherWaysLabel}
              </p>
              {t.premium.otherWays.map((w, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="flex-none w-6 h-6 rounded-full bg-primary-container text-primary text-[12px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 text-[13px] font-medium text-txt">{w.title}</p>
                    <p className="mt-0.5 mb-0 text-[12px] leading-relaxed text-txt2">{w.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Sheet>
    {showHowTo && (
      <HowToBuyStars
        packageStars={selected?.priceStars}
        planTitle={selected?.title}
        onClose={() => setShowHowTo(false)}
      />
    )}
    </>
  )
}
