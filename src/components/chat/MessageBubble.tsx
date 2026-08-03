import { t } from '../../i18n.js'
import { formatTime } from '../../utils/chatFormat.js'
import type { LocalMessage } from '../../types.js'

interface MessageBubbleProps {
  message: LocalMessage
  mine: boolean
  first: boolean
  last: boolean
  showTicks: boolean
  onRetry?: (id: string) => void
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

export function MessageBubble({ message, mine, first, last, showTicks, onRetry }: MessageBubbleProps) {
  const failed = message.status === 'failed'
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
      className={`max-w-[75%] px-4 py-2 rounded-[18px] text-[15px] ${corners} ${
        mine ? 'self-end grad-tg text-white' : 'self-start bg-white/10 text-white'
      } ${failed ? 'opacity-70' : ''} ${last ? 'mb-2' : ''}`}
    >
      <p className="whitespace-pre-wrap break-words">{message.body}</p>
      {failed ? (
        <p className="text-[10px] mt-0.5 text-red-300 font-semibold">{t.chat.failed}</p>
      ) : message.status === 'sending' ? (
        <p className="text-[10px] opacity-60 mt-0.5 flex justify-end"><ClockIcon /></p>
      ) : last ? (
        <p className="text-[10px] opacity-60 mt-0.5 flex items-center gap-1">
          {formatTime(message.createdAt)}
          {showTicks && <SeenTicks seen={!!message.readAt} />}
        </p>
      ) : null}
    </div>
  )
}
