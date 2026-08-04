import { t } from '../../i18n.js'
import type { LocalMessage } from '../../types.js'

interface MessageActionSheetProps {
  message: LocalMessage
  mine: boolean
  onReply: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onRetry: (id: string) => void
  onClose: () => void
}

const itemClass =
  'w-full text-left px-4 py-3 text-[16px] font-semibold rounded-2xl active:bg-white/10'

export function MessageActionSheet({ message, mine, onReply, onEdit, onDelete, onRetry, onClose }: MessageActionSheetProps) {
  const failed = message.status === 'failed'
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        role="menu"
        aria-label={t.chat.messageActions}
        className="glass border border-white/15 rounded-3xl p-2 w-full max-w-sm shadow-2xl select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white/50 text-[13px] px-4 pt-2 pb-1 truncate">{message.body}</p>
        {failed ? (
          <button role="menuitem" onClick={() => onRetry(message.id)} className={`${itemClass} text-white`}>
            {t.chat.retryMessage}
          </button>
        ) : (
          <>
            <button role="menuitem" onClick={() => onReply(message.id)} className={`${itemClass} text-white`}>
              {t.chat.replyAction}
            </button>
            {mine && (
              <button role="menuitem" onClick={() => onEdit(message.id)} className={`${itemClass} text-white`}>
                {t.chat.editAction}
              </button>
            )}
          </>
        )}
        {mine && (
          <button role="menuitem" onClick={() => onDelete(message.id)} className={`${itemClass} text-red-400`}>
            {t.chat.deleteAction}
          </button>
        )}
        <button role="menuitem" onClick={onClose} className={`${itemClass} text-white/60`}>
          {t.chat.cancelAction}
        </button>
      </div>
    </div>
  )
}
