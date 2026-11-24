import { useEffect, useRef, useState } from 'react'
import { api } from '../../api.js'
import { haptic } from '../../telegram.js'
import { t } from '../../i18n.js'
import { useRequestsStore } from '../../store.js'
import type { Match, MessageRequest } from '../../types.js'
import { Avatar, Badge, Icon } from '../ui/index.js'
import { PremiumBadge } from '../premium/PremiumBadge.js'
import { RequestProfileSheet, type RequestAction } from './RequestProfileSheet.js'

interface Props {
  /** Opens the accepted chat; `fallback` is used when the match list can't be refetched. */
  onOpenChat: (matchId: string, fallback: Match) => void
  refreshKey: number
  /** Scroll here once the requests are in (notification deep link). */
  focus?: boolean
}

/** Already decided elsewhere, expired, or the sender is gone. */
const isGone = (err: unknown) =>
  (err instanceof Error && err.message.includes('not_available')) ||
  [404, 409, 410].includes((err as { status?: number } | null)?.status ?? 0)

/** Message requests waiting for my decision; tap one for the profile and Accept / Ignore. */
export function RequestsSection({ onOpenChat, refreshKey, focus = false }: Props) {
  const requests = useRequestsStore((s) => s.received)
  const loadReceived = useRequestsStore((s) => s.loadReceived)
  const removeReceived = useRequestsStore((s) => s.removeReceived)
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState<RequestAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const focused = useRef(false)

  useEffect(() => { loadReceived() }, [refreshKey, loadReceived])

  const hasRequests = requests.length > 0
  useEffect(() => {
    if (!focus || focused.current || !hasRequests) return
    focused.current = true
    rootRef.current?.scrollIntoView({ block: 'start' })
  }, [focus, hasRequests])

  const open = requests.find((r) => r.id === openId) ?? null

  const decide = async (request: MessageRequest, action: RequestAction) => {
    if (busy) return
    haptic.impact(action === 'accept' ? 'medium' : 'light')
    setBusy(action)
    setError(null)
    setNotice(null)
    try {
      if (action === 'accept') {
        const { match } = await api.requests.accept(request.id)
        haptic.notification('success')
        removeReceived(request.id)
        onOpenChat(match.id, {
          id: match.id,
          matchedAt: match.matchedAt,
          user: {
            id: match.user.id,
            name: match.user.name,
            photos: request.user.photos,
            age: request.user.age,
            bio: request.user.bio,
            premium: request.user.premium,
            telegramId: 0,
            username: null,
            icebreakerPrompt: null,
            icebreakerAnswer: null,
          },
          lastMessage: null,
          unreadCount: 0,
        })
      } else {
        await api.requests.ignore(request.id)
        removeReceived(request.id)
      }
      setOpenId(null)
    } catch (err) {
      haptic.notification('error')
      if (isGone(err)) {
        removeReceived(request.id)
        setOpenId(null)
        setNotice(t.requests.gone)
      } else {
        setError(action === 'accept' ? t.requests.acceptError : t.requests.ignoreError)
      }
    } finally {
      setBusy(null)
    }
  }

  if (!hasRequests && !notice) return null

  return (
    <div ref={rootRef} className="flex flex-col gap-2 px-4 pb-4">
      <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-widest text-txt2 px-1">
        {t.requests.title}
        {hasRequests && <Badge>{requests.length}</Badge>}
      </h2>

      {notice && <p role="status" className="text-txt2 text-[13px] px-1">{notice}</p>}

      {requests.map((request) => (
        <button
          key={request.id}
          type="button"
          aria-label={t.requests.openRequest(request.user.name)}
          onClick={() => {
            haptic.selection()
            setError(null)
            setNotice(null)
            setOpenId(request.id)
          }}
          className="w-full text-start bg-surface rounded-m3-lg flex items-center gap-3 px-3.5 py-3 transition-colors active:brightness-95"
        >
          <Avatar src={request.user.photos[0]} size={56} alt={request.user.name} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[16px] text-txt flex items-center gap-1.5">
              <span className="truncate">
                {request.user.name}
                {request.user.age != null && `, ${request.user.age}`}
              </span>
              {request.user.premium && <PremiumBadge size={16} />}
            </p>
            <p className="text-[13px] text-txt2 truncate">{request.body}</p>
          </div>
          <Icon name="chevron-right" size={20} className="rtl:-scale-x-100 text-txt3 flex-none" />
        </button>
      ))}

      {open && (
        <RequestProfileSheet
          request={open}
          busy={busy}
          error={error}
          onClose={() => setOpenId(null)}
          onAccept={() => decide(open, 'accept')}
          onIgnore={() => decide(open, 'ignore')}
          onBlocked={() => {
            removeReceived(open.id)
            setOpenId(null)
            useRequestsStore.getState().loadSent() // a block clears both directions
          }}
        />
      )}
    </div>
  )
}
