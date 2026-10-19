import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../../api.js'
import { t, useLocaleStore, LOCALE_META } from '../../i18n.js'
import { haptic } from '../../telegram.js'
import { Icon, Input } from '../ui'
import type { TonPaysPaymentInfo } from '../../types.js'

interface TonPaysPaymentStepProps {
  payment: TonPaysPaymentInfo
  transactionId: string
  /** The transaction settled — parent does the success haptic/refresh/close. */
  onPaid: () => void
  /** Back to plan selection (also the retry CTA on a terminal failure). */
  onBack: () => void
}

// Poll budget: every 5s for up to 10 minutes.
const TONPAYS_POLL_INTERVAL_MS = 5000
const TONPAYS_POLL_MAX_TRIES = 120

const digitsOnly = (s: string) => s.replace(/\D/g, '')
const formatCardDigits = (digits: string) => digits.replace(/(.{4})/g, '$1 ').trim()

export function TonPaysPaymentStep({ payment, transactionId, onPaid, onBack }: TonPaysPaymentStepProps) {
  const locale = useLocaleStore((s) => s.locale)
  const dir = LOCALE_META[locale].dir
  const c = t.premium.tonpays

  // The destination card can be swapped via "change card" — amount/invoiceId
  // never change for a given checkout, so only card fields are local state.
  const [cardNumber, setCardNumber] = useState(payment.cardNumber)
  const [cardHolder, setCardHolder] = useState(payment.cardHolder)

  const [copied, setCopied] = useState<'amount' | 'card' | null>(null)
  const [remainingAmount, setRemainingAmount] = useState<number | null>(null)
  const [overpaid, setOverpaid] = useState(false)
  // 'failed' = definitively won't pay (canceled/refunded/timeout) → retry CTA
  // back to plan selection is safe. 'grant_failed' = the money WAS received
  // but the premium grant failed server-side — that row is terminal, so a
  // "retry" would create a brand-new invoice and double-charge the user.
  // Distinct copy, no retry CTA.
  const [terminal, setTerminal] = useState<'failed' | 'grant_failed' | null>(null)

  const [changeCardBusy, setChangeCardBusy] = useState(false)
  const [changeCardCooldown, setChangeCardCooldown] = useState(false)
  const [changeCardError, setChangeCardError] = useState(false)

  const [refundCardNumber, setRefundCardNumber] = useState('')
  const [refundCardHolder, setRefundCardHolder] = useState('')
  const [refundBusy, setRefundBusy] = useState(false)
  const [refundError, setRefundError] = useState(false)
  const [refundSubmitted, setRefundSubmitted] = useState(false)

  const mountedRef = useRef(true)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const triesRef = useRef(0)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fresh mount per checkout attempt (the parent unmounts this on "back"), so
  // plain mount/unmount cleanup is the session guard here — no need for the
  // sessionRef indirection PaywallSheet needs for its own persisting instance.
  useEffect(() => {
    mountedRef.current = true
    const clearPolling = () => {
      if (pollTimerRef.current != null) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
    triesRef.current = 0
    pollTimerRef.current = setInterval(async () => {
      if (!mountedRef.current) { clearPolling(); return }
      triesRef.current += 1
      try {
        const res = await api.premium.transaction(transactionId)
        if (!mountedRef.current) { clearPolling(); return }
        // A resumed invoice (back → buy again) can poll straight into a row
        // where the refund card was already submitted on a prior attempt —
        // seed the "submitted" view instead of showing the blank form again.
        if (res.refundPending) setRefundSubmitted(true)
        if (res.status === 'paid') {
          clearPolling()
          onPaid()
          return
        }
        // The money was received but the grant failed internally — this row
        // is terminal, but unlike canceled/refunded/timeout the user must NOT
        // be invited to pay again (that would create a new invoice and
        // double-charge them). Separate terminal state, no retry CTA.
        if (res.status === 'paid_grant_failed') {
          clearPolling()
          setTerminal('grant_failed')
          return
        }
        // Treat any other definitive non-success status as a terminal
        // failure instead of burning the rest of the poll budget.
        if (res.status === 'canceled' || res.status === 'refunded') {
          clearPolling()
          setTerminal('failed')
          return
        }
        if (res.tonpaysStatus === 'action_required_less') {
          setRemainingAmount(res.remainingAmount ?? null)
        } else if (res.tonpaysStatus === 'action_required_more') {
          setOverpaid(true)
        }
      } catch {
        // transient poll failure — counts toward the try budget below
      }
      if (triesRef.current >= TONPAYS_POLL_MAX_TRIES && pollTimerRef.current != null) {
        clearPolling()
        if (mountedRef.current) setTerminal('failed')
      }
    }, TONPAYS_POLL_INTERVAL_MS)
    return () => { mountedRef.current = false; clearPolling() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId])

  useEffect(() => () => {
    if (copiedTimerRef.current != null) clearTimeout(copiedTimerRef.current)
  }, [])

  const flashCopied = (field: 'amount' | 'card') => {
    if (copiedTimerRef.current != null) clearTimeout(copiedTimerRef.current)
    setCopied(field)
    copiedTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setCopied(null)
    }, 1500)
  }

  const copyAmount = async () => {
    try {
      await navigator.clipboard.writeText(String(payment.amountToman))
      haptic.notification('success')
      flashCopied('amount')
    } catch {
      // clipboard unsupported — no-op
    }
  }

  const copyCard = async () => {
    try {
      await navigator.clipboard.writeText(digitsOnly(cardNumber))
      haptic.notification('success')
      flashCopied('card')
    } catch {
      // clipboard unsupported — no-op
    }
  }

  const handleChangeCard = async () => {
    if (changeCardBusy) return
    haptic.selection()
    setChangeCardBusy(true)
    setChangeCardCooldown(false)
    setChangeCardError(false)
    try {
      const res = await api.premium.changeCard(transactionId)
      if (!mountedRef.current) return
      setCardNumber(res.cardNumber)
      setCardHolder(res.cardHolder)
      haptic.notification('success')
    } catch (err) {
      if (!mountedRef.current) return
      const status = (err as { status?: number } | null)?.status
      if (status === 429) setChangeCardCooldown(true)
      else setChangeCardError(true)
    } finally {
      if (mountedRef.current) setChangeCardBusy(false)
    }
  }

  const refundCardDigits = digitsOnly(refundCardNumber)
  const canSubmitRefund = refundCardDigits.length === 16 && refundCardHolder.trim().length > 0

  const handleRefundSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (refundBusy || !canSubmitRefund) return
    haptic.impact('light')
    setRefundBusy(true)
    setRefundError(false)
    try {
      await api.premium.refundCard(transactionId, refundCardDigits, refundCardHolder.trim())
      if (!mountedRef.current) return
      haptic.notification('success')
      setRefundSubmitted(true)
    } catch {
      if (mountedRef.current) setRefundError(true)
    } finally {
      if (mountedRef.current) setRefundBusy(false)
    }
  }

  const copyPillClass =
    'flex-none flex items-center gap-1 rounded-full bg-primary-container text-on-primary-container ' +
    'text-[12px] font-medium px-3 py-1.5 transition-opacity active:opacity-70'

  if (terminal === 'grant_failed') {
    // Payment received, grant failed — no retry CTA (retrying would re-charge
    // the user on a brand-new invoice). Only a support-contact message.
    return (
      <div dir={dir} className="flex flex-col items-center text-center py-8 gap-3">
        <Icon name="alert-triangle" size={30} className="text-error" />
        <p className="m-0 text-txt text-[14px]">{c.grantFailed}</p>
      </div>
    )
  }

  if (terminal === 'failed') {
    return (
      <div dir={dir} className="flex flex-col items-center text-center py-8 gap-3">
        <Icon name="alert-triangle" size={30} className="text-error" />
        <p className="m-0 text-txt text-[14px]">{c.failed}</p>
        <button
          type="button"
          onClick={onBack}
          className="w-full h-12 rounded-full bg-gold-btn text-[#241A00] font-medium text-[15px] mt-1"
        >
          {c.retry}
        </button>
      </div>
    )
  }

  return (
    <div dir={dir}>
      <div className="flex items-center gap-2 mb-3.5">
        <button type="button" onClick={onBack} aria-label={c.back} className="p-1 -ms-1 text-txt2">
          <Icon name={dir === 'rtl' ? 'chevron-right' : 'chevron-left'} size={20} />
        </button>
        <h2 className="m-0 text-[15px] font-semibold text-txt">{c.title}</h2>
      </div>

      <p className="text-txt2 text-[13px] mb-4">{c.instructions}</p>

      {/* Amount */}
      <div className="bg-surface rounded-m3-lg px-4 py-3.5 mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[11px] text-txt3">{c.amountLabel}</p>
          <p dir="ltr" className="mt-0.5 mb-0 text-[20px] font-bold text-txt">
            {payment.amountToman.toLocaleString('en-US')}{' '}
            <span className="text-[13px] font-normal text-txt2">{c.tomanUnit}</span>
          </p>
        </div>
        <button type="button" onClick={copyAmount} className={copyPillClass}>
          <Icon name={copied === 'amount' ? 'check' : 'copy'} size={13} />
          {copied === 'amount' ? c.copied : c.copy}
        </button>
      </div>

      {/* Destination card */}
      <div className="bg-surface rounded-m3-lg px-4 py-3.5 mb-1 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[11px] text-txt3">{c.cardLabel}</p>
          <p dir="ltr" className="mt-0.5 mb-0 text-[18px] font-bold text-txt tracking-wider">
            {formatCardDigits(digitsOnly(cardNumber))}
          </p>
          <p className="mt-0.5 mb-0 text-[12px] text-txt2">{cardHolder}</p>
        </div>
        <button type="button" onClick={copyCard} className={copyPillClass}>
          <Icon name={copied === 'card' ? 'check' : 'copy'} size={13} />
          {copied === 'card' ? c.copied : c.copy}
        </button>
      </div>

      <button
        type="button"
        onClick={handleChangeCard}
        disabled={changeCardBusy}
        className="text-primary text-[12.5px] font-medium mt-2 mb-1 disabled:opacity-50"
      >
        {c.changeCardLink}
      </button>
      {changeCardCooldown && <p className="text-error text-[12px] mb-2 mt-0">{c.changeCardCooldown}</p>}
      {changeCardError && <p className="text-error text-[12px] mb-2 mt-0">{c.changeCardError}</p>}

      <div className="flex items-start gap-2 rounded-m3-md px-3.5 py-3 mt-3 mb-4" style={{ background: 'var(--prtint)' }}>
        <Icon name="alert-triangle" size={15} className="text-primary flex-none mt-0.5" />
        <p className="m-0 text-[12px] leading-relaxed text-txt2">{c.warning}</p>
      </div>

      {remainingAmount != null && (
        <div className="bg-surface rounded-m3-md px-3.5 py-3 mb-3">
          <p className="m-0 text-[13px] font-semibold text-txt">{c.remainingTitle}</p>
          <p className="mt-1 mb-0 text-[12.5px] text-txt2">{c.remainingBody(remainingAmount)}</p>
        </div>
      )}

      {overpaid && (
        <div className="bg-surface rounded-m3-md px-3.5 py-3.5 mb-3">
          <p className="m-0 text-[13px] font-semibold text-txt">{c.overpaidTitle}</p>
          <p className="mt-1 mb-3 text-[12.5px] text-txt2">{c.overpaidBody}</p>
          {refundSubmitted ? (
            <p className="m-0 text-[12.5px] text-primary font-medium">{c.refundSubmitted}</p>
          ) : (
            <form onSubmit={handleRefundSubmit} className="flex flex-col gap-2">
              <Input
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={refundCardNumber}
                onChange={(e) => setRefundCardNumber(formatCardDigits(digitsOnly(e.target.value).slice(0, 16)))}
                placeholder={c.refundCardNumberLabel}
                className="text-[14px] px-3.5 py-3"
              />
              <Input
                type="text"
                value={refundCardHolder}
                onChange={(e) => setRefundCardHolder(e.target.value)}
                placeholder={c.refundCardHolderLabel}
                className="text-[14px] px-3.5 py-3"
              />
              {refundError && <p className="text-error text-[12px] m-0">{c.refundError}</p>}
              <button
                type="submit"
                disabled={refundBusy || !canSubmitRefund}
                className="w-full h-11 rounded-full bg-primary text-white font-medium text-[13.5px] flex items-center justify-center transition-opacity disabled:opacity-45"
              >
                {refundBusy ? (
                  <span
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    style={{ animation: 'lumaSpin .8s linear infinite' }}
                  />
                ) : (
                  c.refundSubmit
                )}
              </button>
            </form>
          )}
        </div>
      )}

      <div className="flex flex-col items-center justify-center gap-2 py-4">
        <div
          className="w-5 h-5 border-2 border-primary-container border-t-primary rounded-full"
          style={{ animation: 'lumaSpin .8s linear infinite' }}
        />
        <p className="text-txt2 text-[12.5px] m-0">{c.waiting}</p>
      </div>
    </div>
  )
}
