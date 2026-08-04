import { useEffect, useRef } from 'react'
import { t } from '../../i18n.js'
import { mainButtonSupported } from '../../telegram.js'

const MAX_LENGTH = 2000
const COUNTER_THRESHOLD = 1800
const MAX_HEIGHT_PX = 96 // ~4 lines, then the textarea scrolls internally

interface ChatInputBarProps {
  draft: string
  onDraftChange: (value: string) => void
  onSend: () => void
  editingBody?: string | null
  onCancelEdit?: () => void
}

export function ChatInputBar({ draft, onDraftChange, onSend, editingBody, onCancelEdit }: ChatInputBarProps) {
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

  return (
    <div
      className="p-4 border-t border-white/10 flex flex-col gap-1"
      style={{ paddingBottom: 'calc(max(var(--tg-safe-bottom), env(safe-area-inset-bottom)) + 16px)' }}
    >
      {editingBody != null && (
        <div className="flex items-center gap-2 pb-1">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-white/80">{t.chat.editingMessage}</p>
            <p className="text-[12px] text-white/50 truncate">{editingBody}</p>
          </div>
          <button
            onClick={onCancelEdit}
            aria-label={t.chat.cancelAction}
            className="text-white/50 text-xl leading-none px-1"
          >
            ✕
          </button>
        </div>
      )}
      {draft.length >= COUNTER_THRESHOLD && (
        <p className="text-[11px] text-white/40 text-right">{MAX_LENGTH - draft.length}</p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={boxRef}
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
          className="flex-1 bg-white/10 rounded-[16px] px-4 py-2 text-white text-[15px] outline-none resize-none"
        />
        {!mainButtonSupported() && !!draft.trim() && (
          <button
            aria-label={editingBody != null ? t.chat.save : t.chat.send}
            onClick={onSend}
            className="grad-tg w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 11.5L21 3l-8.5 18-2.5-7-7-2.5z" fill="white" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
