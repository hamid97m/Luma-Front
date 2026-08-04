import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api.js'
import { haptic, useMainButton } from '../telegram.js'
import { buildChatItems } from '../utils/chatFormat.js'
import { MessageBubble } from '../components/chat/MessageBubble.js'
import { ChatInputBar } from '../components/chat/ChatInputBar.js'
import { ChatEmptyState } from '../components/chat/ChatEmptyState.js'
import { ProfilePeekSheet } from '../components/chat/ProfilePeekSheet.js'
import { MessageActionSheet } from '../components/chat/MessageActionSheet.js'
import { ReportSheet } from '../components/ReportSheet.js'
import { GiftPickerSheet } from '../components/gifts/GiftPickerSheet.js'
import { t } from '../i18n.js'
import type { LocalMessage, Match } from '../types.js'

interface Props {
  match: Match
  myUserId: string
  onBack: () => void
}

type LoadState = 'loading' | 'ready' | 'unavailable' | 'error'

let localSeq = 0

export function Chat({ match, myUserId, onBack }: Props) {
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [draft, setDraft] = useState('')
  const [peeking, setPeeking] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [giftOpen, setGiftOpen] = useState(false)
  const stashedDraft = useRef('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const didInitialScroll = useRef(false)
  const [showJump, setShowJump] = useState(false)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const load = useCallback(() => {
    api.messages.list(match.id)
      .then(({ messages: server }) => {
        setMessages((prev) => {
          const unconfirmed = prev.filter((m) => m.status)
          const byId = new Map(unconfirmed.map((m) => [m.id, m]))
          const merged = server.map((m) => byId.get(m.id) ?? m)
          const extras = unconfirmed.filter((m) => !server.some((s) => s.id === m.id))
          return [...merged, ...extras]
        })
        setLoadState('ready')
      })
      .catch((err: unknown) => {
        setLoadState((s) => {
          if (s === 'ready') return s // a background refresh failing is not fatal
          return (err as { status?: number } | null)?.status === 404 ? 'unavailable' : 'error'
        })
      })
  }, [match.id])

  useEffect(() => { load() }, [load])

  // Weak-server constraint: no polling. Refresh only when the user returns
  // to the app (e.g. after switching to another Telegram chat).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    nearBottomRef.current = nearBottom
    setShowJump(!nearBottom)
  }

  useEffect(() => {
    if (!didInitialScroll.current) {
      if (messages.length === 0) return
      bottomRef.current?.scrollIntoView({ block: 'end' })
      didInitialScroll.current = true
    } else if (nearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    }
  }, [messages])

  const sendBody = useCallback((body: string, existingId?: string, replyToMessageId?: string) => {
    const id = existingId ?? `local-${++localSeq}`
    const optimistic: LocalMessage = {
      id,
      senderId: myUserId,
      body,
      createdAt: new Date().toISOString(),
      readAt: null,
      replyToMessageId: replyToMessageId ?? null,
      type: 'text',
      status: 'sending',
    }
    setMessages((prev) =>
      existingId ? prev.map((m) => (m.id === id ? optimistic : m)) : [...prev, optimistic]
    )
    haptic.impact('light')
    api.messages.send(match.id, body, replyToMessageId)
      .then(({ message }) => {
        setMessages((prev) => prev.some((m) => m.id === message.id)
          ? prev.filter((m) => m.id !== id) // server copy already merged in via a background refresh — drop the local one
          : prev.map((m) => (m.id === id ? message : m)))
      })
      .catch(() => {
        haptic.notification('error')
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...optimistic, status: 'failed' } : m)))
      })
  }, [match.id, myUserId])

  const send = () => {
    const body = draft.trim()
    if (!body) return
    const replyTo = replyingToId
    setDraft('')
    setReplyingToId(null)
    nearBottomRef.current = true
    setShowJump(false)
    sendBody(body, undefined, replyTo ?? undefined)
  }

  const retry = useCallback((id: string) => {
    const msg = messagesRef.current.find((m) => m.id === id)
    if (msg) sendBody(msg.body, id, msg.replyToMessageId ?? undefined)
  }, [sendBody])

  const openActions = useCallback((id: string) => {
    haptic.impact('light')
    setActionId(id)
  }, [])

  const beginEdit = (id: string) => {
    setActionId(null)
    setReplyingToId(null)
    const msg = messagesRef.current.find((m) => m.id === id)
    if (!msg) return
    stashedDraft.current = draft
    setDraft(msg.body)
    setEditingId(id)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraft(stashedDraft.current)
    stashedDraft.current = ''
  }

  const beginReply = (id: string) => {
    setActionId(null)
    if (editingId) cancelEdit()
    setReplyingToId(id)
  }

  const cancelReply = () => setReplyingToId(null)

  const saveEdit = () => {
    const id = editingId
    if (!id) return
    const body = draft.trim()
    if (!body) { cancelEdit(); return } // empty save exits edit mode, no request
    const original = messagesRef.current.find((m) => m.id === id)
    cancelEdit()
    if (!original || body === original.body) return

    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body, status: 'sending' as const } : m)))
    haptic.impact('light')
    api.messages.edit(match.id, id, body)
      .then(({ message }) => {
        setMessages((prev) => prev.map((m) => (m.id === id ? message : m)))
      })
      .catch(() => {
        haptic.notification('error')
        setMessages((prev) => prev.map((m) => (m.id === id ? original : m)))
      })
  }

  const deleteMessage = (id: string) => {
    setActionId(null)
    if (editingId === id) cancelEdit()
    const idx = messagesRef.current.findIndex((m) => m.id === id)
    if (idx === -1) return
    const removed = messagesRef.current[idx]
    setMessages((prev) => prev.filter((m) => m.id !== id))
    if (removed.status === 'failed') return // never reached the server — local removal is enough

    api.messages.delete(match.id, id).catch((err: unknown) => {
      if ((err as { status?: number } | null)?.status === 404) return // already gone — treat as success
      haptic.notification('error')
      setMessages((prev) => {
        const next = [...prev]
        next.splice(Math.min(idx, next.length), 0, removed)
        return next
      })
    })
  }

  const retryFromSheet = (id: string) => {
    setActionId(null)
    retry(id)
  }

  const submit = () => {
    if (editingId) saveEdit()
    else send()
  }

  const items = useMemo(() => buildChatItems(messages), [messages])

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])

  const resolveReply = useCallback((parentId: string | null | undefined) => {
    if (!parentId) return null
    const parent = byId.get(parentId)
    if (!parent) return { author: '', text: t.chat.replyDeleted }
    return { author: parent.senderId === myUserId ? t.chat.replyYou : match.user.name, text: parent.body }
  }, [byId, myUserId, match.user.name])

  // Native Telegram Send button — docks above the keyboard. Hidden when the
  // draft is empty or the match is gone; the in-page button below is the
  // fallback when Telegram provides no MainButton (browser/dev/tests).
  useMainButton({
    text: editingId ? t.chat.save : t.chat.send,
    visible: loadState === 'ready' && !!draft.trim(),
    enabled: !!draft.trim(),
    onClick: submit,
  })

  const lastMineId = [...messages].reverse().find((m) => m.senderId === myUserId && !m.status)?.id ?? null

  if (loadState === 'loading') {
    return (
      <div className="flex items-center justify-center h-full bg-[#0b0b12]">
        <img src="/luma-icon.png" alt="" className="w-14 h-14 rounded-2xl animate-pulse-heart select-none" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0b0b12]" style={{ paddingTop: 'var(--tg-safe-top)' }}>
      <div className="flex items-center gap-2 px-4 pt-12 pb-4 border-b border-white/10 w-full">
        <button
          type="button"
          aria-label={t.chat.viewProfile}
          onClick={() => setPeeking(true)}
          className="flex items-center gap-3 text-left flex-1 min-w-0"
        >
          {match.user.photos[0]
            ? <img src={match.user.photos[0]} alt={match.user.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
            : <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg flex-shrink-0">👤</div>
          }
          <p className="font-bold text-white text-[17px] truncate">
            {match.user.name}
            {match.user.age != null && <span className="text-white/50 font-semibold">, {match.user.age}</span>}
          </p>
        </button>
        <button
          type="button"
          aria-label={t.report.title}
          onClick={() => setShowReport(true)}
          className="w-9 h-9 rounded-full glass-dark flex items-center justify-center text-[16px] text-white/80 flex-shrink-0"
        >
          🚩
        </button>
      </div>

      {loadState === 'unavailable' ? (
        <div className="flex-1 flex items-center justify-center p-8 text-center text-white/50 text-[15px]">
          {t.chat.unavailable}
        </div>
      ) : loadState === 'error' ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-white/50 text-[15px]">{t.chat.loadError}</p>
          <button
            onClick={() => { setLoadState('loading'); load() }}
            className="bg-white/10 text-white font-semibold px-5 py-2 rounded-xl"
          >
            {t.chat.retry}
          </button>
        </div>
      ) : (
        <>
          {messages.length === 0 ? (
            <ChatEmptyState match={match} onPrefill={setDraft} />
          ) : (
            <div className="relative flex-1 flex flex-col overflow-hidden">
              <div ref={listRef} onScroll={onScroll} role="log" aria-label="Messages" className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-[2px]">
                {items.map((item) =>
                  item.kind === 'date' ? (
                    <div key={item.id} className="self-center glass-dark text-white/60 text-[11px] font-semibold px-3 py-1 rounded-full my-2">
                      {item.label}
                    </div>
                  ) : (
                    <MessageBubble
                      key={item.message.id}
                      message={item.message}
                      mine={item.message.senderId === myUserId}
                      first={item.first}
                      last={item.last}
                      showTicks={item.message.id === lastMineId}
                      reply={resolveReply(item.message.replyToMessageId)}
                      counterpartName={match.user.name}
                      onRetry={retry}
                      onLongPress={item.message.status !== 'sending' ? openActions : undefined}
                    />
                  )
                )}
                <div ref={bottomRef} />
              </div>
              {showJump && (
                <button
                  aria-label={t.chat.scrollToLatest}
                  onClick={() => bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })}
                  className="absolute bottom-3 right-4 w-10 h-10 rounded-full glass border border-white/15 text-white text-lg flex items-center justify-center"
                >
                  ↓
                </button>
              )}
            </div>
          )}

          <ChatInputBar
            draft={draft}
            onDraftChange={setDraft}
            onSend={submit}
            editingBody={editingId ? messagesRef.current.find((m) => m.id === editingId)?.body ?? null : null}
            onCancelEdit={cancelEdit}
            replyingToBody={replyingToId ? messagesRef.current.find((m) => m.id === replyingToId)?.body ?? null : null}
            onCancelReply={cancelReply}
            onGiftClick={() => setGiftOpen(true)}
          />
        </>
      )}

      <GiftPickerSheet
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        target={{ context: 'chat', matchId: match.id }}
        recipientName={match.user.name}
        onSent={load}
      />

      {peeking && (
        <ProfilePeekSheet
          user={match.user}
          onClose={() => setPeeking(false)}
          onReport={() => {
            setPeeking(false)
            setShowReport(true)
          }}
        />
      )}

      {showReport && (
        <ReportSheet
          reportedUserId={match.user.id}
          context="chat"
          matchId={match.id}
          onClose={() => setShowReport(false)}
          onSubmitted={() => {
            setShowReport(false)
            window.Telegram?.WebApp?.showAlert?.(t.report.thanks)
            onBack()
          }}
        />
      )}

      {actionId && (() => {
        const msg = messages.find((m) => m.id === actionId)
        return msg ? (
          <MessageActionSheet
            message={msg}
            mine={msg.senderId === myUserId}
            onReply={beginReply}
            onEdit={beginEdit}
            onDelete={deleteMessage}
            onRetry={retryFromSheet}
            onClose={() => setActionId(null)}
          />
        ) : null
      })()}
    </div>
  )
}
