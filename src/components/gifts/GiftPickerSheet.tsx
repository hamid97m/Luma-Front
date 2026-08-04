import { useEffect, useRef, useState } from 'react'
import { api } from '../../api.js'
import { t } from '../../i18n.js'
import { openInvoice, haptic } from '../../telegram.js'
import type { GiftCatalogItem } from '../../types.js'

interface GiftPickerSheetProps {
  open: boolean
  onClose: () => void
  target: { context: 'chat'; matchId: string } | { context: 'discovery'; targetUserId: string }
  recipientName: string
  onSent?: () => void
}

type Phase = 'idle' | 'sending' | 'refunded' | 'error'

const POLL_INTERVAL_MS = 1500
const POLL_MAX_TRIES = 8

export function GiftPickerSheet({ open, onClose, target, recipientName, onSent }: GiftPickerSheetProps) {
  const [gifts, setGifts] = useState<GiftCatalogItem[] | null>(null)
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [busy, setBusy] = useState(false)

  const mountedRef = useRef(true)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollTriesRef = useRef(0)
  // Bumped whenever the sheet opens (fresh session) or closes — every async
  // continuation captures the session it started with and bails if it no
  // longer matches, so a checkout/poll abandoned by closing (or superseded
  // by a later reopen) can never open an invoice or close a *newer* session.
  const sessionRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const clearPolling = () => {
    if (pollTimerRef.current != null) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  // Reset state and (re)fetch the catalog whenever the sheet opens; always
  // stop any in-flight polling when it closes or unmounts.
  useEffect(() => {
    if (!open) {
      clearPolling()
      return
    }

    sessionRef.current += 1
    const session = sessionRef.current

    setGifts(null)
    setSelectedGiftId(null)
    setNote('')
    setPhase('idle')
    setBusy(false)

    api.gifts
      .catalog()
      .then((res) => {
        if (mountedRef.current && session === sessionRef.current) setGifts(res.gifts)
      })
      .catch(() => {
        if (mountedRef.current && session === sessionRef.current) setGifts([])
      })

    return () => {
      clearPolling()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const handleClose = () => {
    clearPolling()
    sessionRef.current += 1
    onClose()
  }

  const selectGift = (gift: GiftCatalogItem) => {
    if (busy || phase === 'sending') return
    haptic.selection()
    setSelectedGiftId(gift.giftId)
  }

  const startPolling = (transactionId: string, session: number) => {
    clearPolling()
    pollTriesRef.current = 0
    pollTimerRef.current = setInterval(async () => {
      if (!mountedRef.current || session !== sessionRef.current) {
        clearPolling()
        return
      }
      pollTriesRef.current += 1
      try {
        const res = await api.gifts.transaction(transactionId)
        if (!mountedRef.current || session !== sessionRef.current) {
          clearPolling()
          return
        }
        if (res.status === 'sent') {
          clearPolling()
          haptic.notification('success')
          onSent?.()
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

  const handleSend = async () => {
    const gift = gifts?.find((g) => g.giftId === selectedGiftId)
    if (!gift || busy) return

    // Capture the session this checkout belongs to. If the sheet is closed
    // (or closed+reopened) before an await below resolves, sessionRef will
    // have moved on and every check below bails instead of opening an
    // invoice for an abandoned checkout or closing a newer session.
    const session = sessionRef.current

    haptic.impact('medium')
    setBusy(true)
    setPhase('idle')

    try {
      const { transactionId, invoiceLink } = await api.gifts.checkout({
        ...target,
        giftId: gift.giftId,
        note: note.trim() || undefined,
      })
      if (!mountedRef.current || session !== sessionRef.current) return

      const status = await openInvoice(invoiceLink)
      if (!mountedRef.current || session !== sessionRef.current) return

      if (status === 'paid') {
        setPhase('sending')
        startPolling(transactionId, session)
      } else if (status === 'cancelled') {
        handleClose()
        return
      } else {
        setPhase('error')
      }
    } catch {
      if (mountedRef.current && session === sessionRef.current) setPhase('error')
    } finally {
      if (mountedRef.current && session === sessionRef.current) setBusy(false)
    }
  }

  const selectedGift = gifts?.find((g) => g.giftId === selectedGiftId) ?? null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4" onClick={handleClose}>
      <div
        className="glass border border-white/15 rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(1.5rem + var(--tg-safe-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-extrabold text-white">{t.gifts.title(recipientName)}</h2>
          <button onClick={handleClose} aria-label={t.gifts.close} className="text-white/50 text-2xl leading-none">
            ✕
          </button>
        </div>

        {phase === 'refunded' && (
          <p className="text-rose-400 text-[14px] mb-4">{t.gifts.refunded}</p>
        )}
        {phase === 'error' && (
          <p className="text-rose-400 text-[14px] mb-4">{t.gifts.error}</p>
        )}

        {phase === 'sending' ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-white/70 text-[14px]">{t.gifts.sending}</p>
          </div>
        ) : gifts === null ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        ) : gifts.length === 0 ? (
          <p className="text-white/60 text-[14px] text-center py-10">{t.gifts.unavailable}</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4 max-h-[40vh] overflow-y-auto">
              {gifts.map((gift) => {
                const selected = gift.giftId === selectedGiftId
                return (
                  <button
                    key={gift.giftId}
                    type="button"
                    onClick={() => selectGift(gift)}
                    disabled={busy}
                    className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 transition-colors disabled:opacity-50 ${
                      selected ? 'border-[#ec4067] bg-[#ec4067]/15' : 'border-white/12 bg-white/5'
                    }`}
                  >
                    <span className="text-3xl">{gift.emoji ?? '🎁'}</span>
                    <span className="text-white/80 text-[12px] font-semibold">⭐ {gift.chargedStars}</span>
                  </button>
                )
              })}
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={128}
              placeholder={t.gifts.notePlaceholder}
              rows={2}
              disabled={busy}
              className="w-full rounded-2xl bg-white/5 border border-white/12 p-3 text-[14px] text-white placeholder:text-white/40 mb-4 disabled:opacity-50"
            />

            <button onClick={handleSend} disabled={!selectedGift || busy} className="btn-primary flex items-center justify-center gap-2">
              {busy ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : selectedGift ? (
                t.gifts.send(selectedGift.emoji ?? '🎁', selectedGift.chargedStars)
              ) : (
                t.gifts.selectPrompt
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
