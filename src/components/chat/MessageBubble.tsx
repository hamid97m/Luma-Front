import { memo, useRef } from 'react'
import { t } from '../../i18n.js'
import { formatTime } from '../../utils/chatFormat.js'
import { GiftBubble } from '../gifts/GiftBubble.js'
import { Icon } from '../ui/index.js'
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
    <span role="img" aria-label={seen ? t.aria.seen : t.aria.sent} className="inline-flex text-white/70">
      <Icon name={seen ? 'check-check' : 'check'} size={13} strokeWidth={2.2} />
    </span>
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
  // face their neighbors, on the sender's side. Logical corners (se/ee = the
  // inline-end side, ss/es = inline-start) so under RTL — where `self-end`
  // puts my bubbles on the LEFT, Telegram-fa style — the flattened corners
  // still hug the correct outer edge.
  const corners = mine
    ? `${first ? '' : 'rounded-se-[6px] '}${last ? '' : 'rounded-ee-[6px]'}`
    : `${first ? '' : 'rounded-ss-[6px] '}${last ? '' : 'rounded-es-[6px]'}`

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (failed && onRetry && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onRetry(message.id)
    }
  }

  const metaColor = mine ? 'text-white/70' : 'text-txt3'

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
      className={`max-w-[75%] px-4 py-2 rounded-m3-lg text-[15px] ${corners} ${
        mine ? 'self-end bg-primary text-white' : 'self-start bg-surface text-txt'
      } ${failed ? 'opacity-70' : ''} ${last ? 'mb-2' : ''} ${onLongPress ? 'select-none' : ''}`}
    >
      {reply && (
        <div className={`mb-1 px-2 py-1 rounded-m3-sm border-s-2 ${mine ? 'border-white/70 bg-black/15' : 'border-primary bg-bg'}`}>
          {reply.author && <p className="text-[11px] font-bold opacity-90 truncate">{reply.author}</p>}
          <p className="text-[12px] opacity-70 truncate">{reply.text}</p>
        </div>
      )}
      <p className="whitespace-pre-wrap break-words">{message.body}</p>
      {failed ? (
        <p className="text-[10px] mt-0.5 text-white font-semibold">{t.chat.failed}</p>
      ) : message.status === 'sending' ? (
        <p className={`text-[10px] mt-0.5 flex justify-end ${metaColor}`} aria-label={t.chat.sendingLabel}>
          <Icon name="clock" size={11} strokeWidth={1.8} />
        </p>
      ) : last || message.editedAt ? (
        <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${metaColor}`}>
          {message.editedAt && <span>{t.chat.edited}</span>}
          {last && formatTime(message.createdAt)}
          {last && showTicks && <SeenTicks seen={!!message.readAt} />}
        </p>
      ) : null}
    </div>
  )
}

export const MessageBubble = memo(MessageBubbleImpl)
