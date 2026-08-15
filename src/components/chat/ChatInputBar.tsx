import { useEffect, useRef } from 'react'
import { t } from '../../i18n.js'
import { haptic } from '../../telegram.js'
import { IconButton, Icon } from '../ui/index.js'

const MAX_LENGTH = 2000
const COUNTER_THRESHOLD = 1800
const MAX_HEIGHT_PX = 96 // ~4 lines, then the textarea scrolls internally

interface ChatInputBarProps {
  draft: string
  onDraftChange: (value: string) => void
  onSend: () => void
  editingBody?: string | null
  onCancelEdit?: () => void
  replyingToBody?: string | null
  onCancelReply?: () => void
  onGiftClick?: () => void
}

export function ChatInputBar({ draft, onDraftChange, onSend, editingBody, onCancelEdit, replyingToBody, onCancelReply, onGiftClick }: ChatInputBarProps) {
  const boxRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow: runs on every draft change (typing, prefill, clear-on-send).
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [draft])

  // Entering edit mode (or switching edit targets) opens the keyboard with
  // the cursor at the end of the prefilled text, like Telegram.
  useEffect(() => {
    if (editingBody == null) return
    const el = boxRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [editingBody])

  // Entering reply mode opens the keyboard so the user can type immediately.
  useEffect(() => {
    if (replyingToBody == null) return
    boxRef.current?.focus()
  }, [replyingToBody])

  return (
    <div
      className="px-3 pt-2.5 bg-surface flex flex-col gap-1"
      style={{ paddingBottom: 'calc(max(var(--tg-safe-bottom), env(safe-area-inset-bottom)) + 16px)' }}
    >
      {editingBody != null && (
        <div className="flex items-center gap-2 pb-1">
          <div className="flex-1 min-w-0 border-s-2 border-primary ps-2">
            <p className="text-[11px] font-bold text-primary">{t.chat.editingMessage}</p>
            <p className="text-[12px] text-txt2 truncate">{editingBody}</p>
          </div>
          <button
            onClick={onCancelEdit}
            aria-label={t.chat.cancelAction}
            className="text-txt2 p-1 flex-none"
          >
            <Icon name="x" size={16} strokeWidth={2.4} />
          </button>
        </div>
      )}
      {editingBody == null && replyingToBody != null && (
        <div className="flex items-center gap-2 pb-1">
          <div className="flex-1 min-w-0 border-s-2 border-primary ps-2">
            <p className="text-[11px] font-bold text-primary">{t.chat.replyingLabel}</p>
            <p className="text-[12px] text-txt2 truncate">{replyingToBody}</p>
          </div>
          <button
            onClick={onCancelReply}
            aria-label={t.chat.cancelAction}
            className="text-txt2 p-1 flex-none"
          >
            <Icon name="x" size={16} strokeWidth={2.4} />
          </button>
        </div>
      )}
      {draft.length >= COUNTER_THRESHOLD && (
        <p className="text-[11px] text-txt3 text-right">{MAX_LENGTH - draft.length}</p>
      )}
      {/* USER REQUIREMENT: the send button must sit to the RIGHT of the input,
          Telegram-style, even under global RTL. dir="ltr" pins the row's flex
          order physically (gift left, textarea center, send right); the
          textarea itself re-declares dir="rtl" so message text stays RTL. */}
      <div className="flex items-end gap-2" dir="ltr">
        <button
          type="button"
          aria-label={t.gifts.openButton}
          onClick={() => {
            haptic.selection()
            onGiftClick?.()
          }}
          className="w-11 h-11 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-none transition-colors hover:brightness-95"
        >
          <Icon name="gift" size={18} />
        </button>
        <textarea
          ref={boxRef}
          dir="rtl"
          rows={1}
          maxLength={MAX_LENGTH}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder={t.chat.placeholder}
          className="flex-1 bg-field text-txt text-[15px] rounded-[22px] px-4 py-2.5 outline-none resize-none border border-transparent focus:border-primary transition-colors placeholder:text-txt3"
        />
        {!!draft.trim() && (
          <IconButton
            aria-label={editingBody != null ? t.chat.save : t.chat.send}
            onClick={onSend}
            icon="send"
            tone="primary"
            size={44}
            iconSize={18}
          />
        )}
      </div>
    </div>
  )
}
