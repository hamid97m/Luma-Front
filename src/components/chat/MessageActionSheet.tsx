import { t } from '../../i18n.js'
import { Sheet, Icon, type IconName } from '../ui/index.js'
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

const rowClass =
  'w-full text-left px-4 py-3.5 text-[15px] rounded-m3-md flex items-center gap-3.5 transition-colors'

function ActionRow({ icon, label, onClick, tone = 'default' }: {
  icon: IconName
  label: string
  onClick: () => void
  tone?: 'default' | 'destructive'
}) {
  const color = tone === 'destructive' ? 'text-error hover:bg-error-container' : 'text-txt hover:bg-surface'
  const iconColor = tone === 'destructive' ? 'text-error' : 'text-txt2'
  return (
    <button role="menuitem" onClick={onClick} className={`${rowClass} ${color}`}>
      <span className={iconColor}><Icon name={icon} size={18} /></span>
      {label}
    </button>
  )
}

export function MessageActionSheet({ message, mine, onReply, onEdit, onDelete, onRetry, onClose }: MessageActionSheetProps) {
  const failed = message.status === 'failed'
  return (
    <Sheet open onClose={onClose} className="select-none">
      <div role="menu" aria-label={t.chat.messageActions}>
        <p className="text-txt2 text-[12px] px-4 pb-2.5 truncate border-b border-outline-variant">
          {message.body}
        </p>
        <div className="pt-1">
          {failed ? (
            <ActionRow icon="refresh" label={t.chat.retryMessage} onClick={() => onRetry(message.id)} />
          ) : (
            <>
              <ActionRow icon="reply" label={t.chat.replyAction} onClick={() => onReply(message.id)} />
              {mine && <ActionRow icon="pencil" label={t.chat.editAction} onClick={() => onEdit(message.id)} />}
            </>
          )}
          {mine && (
            <ActionRow icon="trash" label={t.chat.deleteAction} onClick={() => onDelete(message.id)} tone="destructive" />
          )}
          <button role="menuitem" onClick={onClose} className={`${rowClass} text-txt2 hover:bg-surface`}>
            {t.chat.cancelAction}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
