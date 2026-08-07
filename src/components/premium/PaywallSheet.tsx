import { useEffect, useRef, useState } from 'react'
import { api } from '../../api.js'
import { t } from '../../i18n.js'
import { openInvoice, haptic } from '../../telegram.js'
import { usePremiumStore } from '../../store.js'
import { formatCountdown } from '../../utils/premium.js'
import { Button, Icon, Sheet } from '../ui'

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

  return (
    <Sheet open onClose={handleClose} title={t.premium.title}>
      <p className="text-txt2 text-[14px] mb-4 -mt-1">{subtitle ?? t.premium.subtitle}</p>

      {phase === 'refunded' && <p className="text-error text-[14px] mb-4">{t.premium.refunded}</p>}
      {phase === 'error' && <p className="text-error text-[14px] mb-4">{t.premium.error}</p>}

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
                  className={`text-left rounded-m3-md p-4 transition-colors disabled:opacity-50 ${
                    isSelected ? 'bg-primary-container text-on-primary-container' : 'bg-surface text-txt'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[15px] flex items-center gap-2">
                      {plan.title}
                      {isSelected && <Icon name="check" size={18} className="text-primary" />}
                    </span>
                    {plan.discountPercent != null && (
                      <span className="bg-primary text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                        -{plan.discountPercent}%
                      </span>
                    )}
                  </div>
                  <div className={`text-[12px] mt-0.5 ${isSelected ? 'text-on-primary-container' : 'text-txt2'}`}>
                    {t.premium.days(plan.durationDays)}
                    {plan.description ? ` · ${plan.description}` : ''}
                  </div>
                  <div className="flex items-baseline gap-2 mt-2">
                    {plan.originalPriceStars != null && (
                      <span className={`text-[13px] line-through inline-flex items-center gap-0.5 ${isSelected ? 'text-on-primary-container' : 'text-txt3'}`}>
                        <Icon name="star" size={12} className="text-primary" />{plan.originalPriceStars}
                      </span>
                    )}
                    <span className="font-bold text-[16px] inline-flex items-center gap-1">
                      <Icon name="star" size={15} className="text-primary" />{plan.priceStars}
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

          <Button onClick={handleBuy} disabled={!selected || busy} block size="lg">
            {busy ? (
              <span
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                style={{ animation: 'lumaSpin .8s linear infinite' }}
              />
            ) : selected ? (
              t.premium.buy(selected.priceStars)
            ) : (
              t.premium.selectPrompt
            )}
          </Button>
        </>
      )}
    </Sheet>
  )
}
