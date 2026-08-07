import { useEffect, useRef, useState } from 'react'
import { api } from '../../api.js'
import { t } from '../../i18n.js'
import { openInvoice, haptic } from '../../telegram.js'
import type { GiftCatalogItem } from '../../types.js'
import { Button, Icon, Sheet, Textarea } from '../ui'

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
    <Sheet open onClose={handleClose} title={t.gifts.title(recipientName)}>
      {phase === 'refunded' && (
        <p className="text-error text-[14px] mb-4">{t.gifts.refunded}</p>
      )}
      {phase === 'error' && (
        <p className="text-error text-[14px] mb-4">{t.gifts.error}</p>
      )}

      {phase === 'sending' ? (
        <div className="flex flex-col items-center justify-center py-10">
          <div
            className="w-7 h-7 border-[3px] border-primary-container border-t-primary rounded-full mb-3"
            style={{ animation: 'lumaSpin .8s linear infinite' }}
          />
          <p className="text-txt2 text-[14px]">{t.gifts.sending}</p>
        </div>
      ) : gifts === null ? (
        <div className="flex items-center justify-center py-10">
          <div
            className="w-7 h-7 border-[3px] border-primary-container border-t-primary rounded-full"
            style={{ animation: 'lumaSpin .8s linear infinite' }}
          />
        </div>
      ) : gifts.length === 0 ? (
        <p className="text-txt2 text-[14px] text-center py-10">{t.gifts.unavailable}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3.5 max-h-[40vh] overflow-y-auto">
            {gifts.map((gift) => {
              const selected = gift.giftId === selectedGiftId
              return (
                <button
                  key={gift.giftId}
                  type="button"
                  onClick={() => selectGift(gift)}
                  disabled={busy}
                  className={`flex flex-col items-center justify-center gap-1 rounded-m3-md p-3 transition-colors disabled:opacity-50 ${
                    selected ? 'bg-primary-container text-on-primary-container' : 'bg-surface text-txt2'
                  }`}
                >
                  {gift.emoji ? (
                    <span className="text-3xl">{gift.emoji}</span>
                  ) : (
                    <Icon name="gift" size={30} />
                  )}
                  <span className="text-[12px] font-medium flex items-center gap-1">
                    <Icon name="star" size={13} className="text-primary" />
                    {gift.chargedStars}
                  </span>
                </button>
              )
            })}
          </div>

          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={128}
            placeholder={t.gifts.notePlaceholder}
            rows={2}
            disabled={busy}
            className="mb-3.5"
          />

          <Button onClick={handleSend} disabled={!selectedGift || busy} block size="lg">
            {busy ? (
              <span
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                style={{ animation: 'lumaSpin .8s linear infinite' }}
              />
            ) : selectedGift ? (
              t.gifts.send(selectedGift.emoji ?? '🎁', selectedGift.chargedStars)
            ) : (
              t.gifts.selectPrompt
            )}
          </Button>
        </>
      )}
    </Sheet>
  )
}
