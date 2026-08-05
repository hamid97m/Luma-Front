import { useEffect, useRef, useState } from 'react'
import { api } from '../../api.js'
import { t } from '../../i18n.js'
import { openInvoice, haptic } from '../../telegram.js'
import { usePremiumStore } from '../../store.js'

interface PaywallSheetProps {
  open: boolean
  onClose: () => void
}

type Phase = 'idle' | 'activating' | 'refunded' | 'error'

const POLL_INTERVAL_MS = 1500
const POLL_MAX_TRIES = 8

export function PaywallSheet({ open, onClose }: PaywallSheetProps) {
  const status = usePremiumStore((s) => s.status)
  const plans = status?.plans ?? []
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [busy, setBusy] = useState(false)

  const mountedRef = useRef(true)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollTriesRef = useRef(0)
  // Same session-guard pattern as GiftPickerSheet: async continuations bail
  // when the sheet was closed/reopened after they started.
  const sessionRef = useRef(0)

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
    usePremiumStore.getState().refresh()
    return () => { clearPolling() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4" onClick={handleClose}>
      <div
        className="glass border border-white/15 rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(1.5rem + var(--tg-safe-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-extrabold text-white">{t.premium.title}</h2>
          <button onClick={handleClose} aria-label={t.premium.close} className="text-white/50 text-2xl leading-none">✕</button>
        </div>
        <p className="text-white/60 text-[14px] mb-5">{t.premium.subtitle}</p>

        {phase === 'refunded' && <p className="text-rose-400 text-[14px] mb-4">{t.premium.refunded}</p>}
        {phase === 'error' && <p className="text-rose-400 text-[14px] mb-4">{t.premium.error}</p>}

        {phase === 'activating' ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-white/70 text-[14px]">{t.premium.activating}</p>
          </div>
        ) : plans.length === 0 ? (
          <p className="text-white/60 text-[14px] text-center py-10">{t.premium.noPlans}</p>
        ) : (
          <>
            <div className="flex flex-col gap-3 mb-4">
              {plans.map((plan) => {
                const isSelected = plan.id === selectedId
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => { if (!busy) { haptic.selection(); setSelectedId(plan.id) } }}
                    disabled={busy}
                    className={`text-left rounded-2xl border p-4 transition-colors disabled:opacity-50 ${
                      isSelected ? 'border-[#ec4067] bg-[#ec4067]/15' : 'border-white/12 bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white font-bold text-[15px]">{plan.title}</span>
                      {plan.discountPercent != null && (
                        <span className="bg-[#ec4067] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                          -{plan.discountPercent}%
                        </span>
                      )}
                    </div>
                    <div className="text-white/50 text-[12px] mt-0.5">
                      {t.premium.days(plan.durationDays)}
                      {plan.description ? ` · ${plan.description}` : ''}
                    </div>
                    <div className="flex items-baseline gap-2 mt-1.5">
                      {plan.originalPriceStars != null && (
                        <span className="text-white/40 text-[13px] line-through">⭐{plan.originalPriceStars}</span>
                      )}
                      <span className="text-white font-extrabold text-[16px]">⭐{plan.priceStars}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            <button onClick={handleBuy} disabled={!selected || busy} className="btn-primary flex items-center justify-center gap-2">
              {busy ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : selected ? (
                t.premium.buy(selected.priceStars)
              ) : (
                t.premium.selectPrompt
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
