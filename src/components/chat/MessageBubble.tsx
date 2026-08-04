import { memo, useRef } from 'react'
import { t } from '../../i18n.js'
import { formatTime } from '../../utils/chatFormat.js'
import { GiftBubble } from '../gifts/GiftBubble.js'
import type { LocalMessage } from '../../types.js'

const LONG_PRESS_MS = 450
const MOVE_TOLERANCE_PX = 10

interface MessageBubbleProps {
  message: LocalMessage
  mine: boolean
  first: boolean
  last: boolean
  showTicks: boolean
  onRetry?: (id: string) => void
  onLongPress?: (id: string) => void
  reply?: { author: string; text: string } | null
  /** The other participant's name — needed for the "{name} sent you a gift" caption. */
  counterpartName?: string
}

function SeenTicks({ seen }: { seen: boolean }) {
  return (
    <span role="img" aria-label={seen ? 'Seen' : 'Sent'} className="inline-flex text-white/60">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={seen ? '-mr-1.5' : ''}>
        <path d="M2 8.5L6 12L14 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {seen && (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M2 8.5L6 12L14 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

function ClockIcon() {
  return (
    <svg role="img" aria-label={t.chat.sendingLabel} width="11" height="11" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function MessageBubbleImpl({ message, mine, first, last, showTicks, onRetry, onLongPress, reply, counterpartName = '' }: MessageBubbleProps) {
  const failed = message.status === 'failed'
  const pressTimer = useRef<number | null>(null)
  const pressStart = useRef<{ x: number; y: number } | null>(null)

  if (message.type === 'gift') {
    return <GiftBubble mine={mine} senderName={counterpartName} emoji={message.gift?.emoji ?? null} />
  }

  const clearPress = () => {
    if (pressTimer.current != null) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onLongPress) return
    pressStart.current = { x: e.clientX, y: e.clientY }
    clearPress()
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null
      onLongPress(message.id)
    }, LONG_PRESS_MS)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pressTimer.current == null || !pressStart.current) return
    if (
      Math.abs(e.clientX - pressStart.current.x) > MOVE_TOLERANCE_PX ||
      Math.abs(e.clientY - pressStart.current.y) > MOVE_TOLERANCE_PX
    ) clearPress()
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onLongPress) return
    e.preventDefault()
    clearPress()
    onLongPress(message.id)
  }

  // Telegram-style grouping: bubbles inside a group flatten the corners that
  // face their neighbors, on the sender's side.
  const corners = mine
    ? `${first ? '' : 'rounded-tr-[6px] '}${last ? '' : 'rounded-br-[6px]'}`
    : `${first ? '' : 'rounded-tl-[6px] '}${last ? '' : 'rounded-bl-[6px]'}`

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (failed && onRetry && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onRetry(message.id)
    }
  }

  return (
    <div
      role={failed ? 'button' : undefined}
      tabIndex={failed ? 0 : undefined}
      onClick={failed && onRetry ? () => onRetry(message.id) : undefined}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearPress}
      onPointerLeave={clearPress}
      onPointerCancel={clearPress}
      onContextMenu={handleContextMenu}
      style={onLongPress ? { WebkitTouchCallout: 'none', WebkitUserSelect: 'none' } : undefined}
      className={`max-w-[75%] px-4 py-2 rounded-[18px] text-[15px] ${corners} ${
        mine ? 'self-end grad-tg text-white' : 'self-start bg-white/10 text-white'
      } ${failed ? 'opacity-70' : ''} ${last ? 'mb-2' : ''} ${onLongPress ? 'select-none' : ''}`}
    >
      {reply && (
        <div className={`mb-1 px-2 py-1 rounded-lg border-l-2 ${mine ? 'border-white/70 bg-black/15' : 'border-white/40 bg-white/5'}`}>
          {reply.author && <p className="text-[11px] font-bold opacity-90 truncate">{reply.author}</p>}
          <p className="text-[12px] opacity-70 truncate">{reply.text}</p>
        </div>
      )}
      <p className="whitespace-pre-wrap break-words">{message.body}</p>
      {failed ? (
        <p className="text-[10px] mt-0.5 text-red-300 font-semibold">{t.chat.failed}</p>
      ) : message.status === 'sending' ? (
        <p className="text-[10px] opacity-60 mt-0.5 flex justify-end"><ClockIcon /></p>
      ) : last || message.editedAt ? (
        <p className="text-[10px] opacity-60 mt-0.5 flex items-center gap-1">
          {message.editedAt && <span>{t.chat.edited}</span>}
          {last && formatTime(message.createdAt)}
          {last && showTicks && <SeenTicks seen={!!message.readAt} />}
        </p>
      ) : null}
    </div>
  )
}

export const MessageBubble = memo(MessageBubbleImpl)
