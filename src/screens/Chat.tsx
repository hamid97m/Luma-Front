import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { haptic, mainButtonSupported, useMainButton } from '../telegram.js'
import { buildChatItems } from '../utils/chatFormat.js'
import { MessageBubble } from '../components/chat/MessageBubble.js'
import type { LocalMessage, Match } from '../types.js'

interface Props {
  match: Match
  myUserId: string
}

let localSeq = 0

export function Chat({ match, myUserId }: Props) {
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.messages.list(match.id)
      .then(({ messages }) => setMessages(messages))
      .catch(() => setUnavailable(true))
      .finally(() => setLoading(false))
  }, [match.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const sendBody = (body: string, existingId?: string) => {
    const id = existingId ?? `local-${++localSeq}`
    const optimistic: LocalMessage = {
      id,
      senderId: myUserId,
      body,
      createdAt: new Date().toISOString(),
      readAt: null,
      status: 'sending',
    }
    setMessages((prev) =>
      existingId ? prev.map((m) => (m.id === id ? optimistic : m)) : [...prev, optimistic]
    )
    haptic.impact('light')
    api.messages.send(match.id, body)
      .then(({ message }) => {
        setMessages((prev) => prev.map((m) => (m.id === id ? message : m)))
      })
      .catch(() => {
        haptic.notification('error')
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...optimistic, status: 'failed' } : m)))
      })
  }

  const send = () => {
    const body = draft.trim()
    if (!body) return
    setDraft('')
    sendBody(body)
  }

  const retry = (id: string) => {
    const msg = messages.find((m) => m.id === id)
    if (msg) sendBody(msg.body, id)
  }

  // Native Telegram Send button — docks above the keyboard. Hidden when the
  // draft is empty or the match is gone; the in-page button below is the
  // fallback when Telegram provides no MainButton (browser/dev/tests).
  useMainButton({
    text: 'Send',
    visible: !loading && !unavailable && !!draft.trim(),
    enabled: !!draft.trim(),
    onClick: send,
  })

  const lastMineId = [...messages].reverse().find((m) => m.senderId === myUserId && !m.status)?.id ?? null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0b0b12]">
        <img src="/luma-icon.png" alt="" className="w-14 h-14 rounded-2xl animate-pulse-heart select-none" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0b0b12]" style={{ paddingTop: 'var(--tg-safe-top)' }}>
      <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-white/10">
        {match.user.photos[0]
          ? <img src={match.user.photos[0]} alt={match.user.name} className="w-10 h-10 rounded-full object-cover" />
          : <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg">👤</div>
        }
        <p className="font-bold text-white text-[17px]">{match.user.name}</p>
      </div>

      {unavailable ? (
        <div className="flex-1 flex items-center justify-center p-8 text-center text-white/50 text-[15px]">
          This match is no longer available.
        </div>
      ) : (
        <>
          <div role="log" aria-label="Messages" className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-[2px]">
            {buildChatItems(messages).map((item) =>
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
                  onRetry={retry}
                />
              )
            )}
            <div ref={bottomRef} />
          </div>

          <div
            className="p-4 border-t border-white/10 flex flex-col gap-1"
            style={{ paddingBottom: 'calc(max(var(--tg-safe-bottom), env(safe-area-inset-bottom)) + 16px)' }}
          >
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send() }}
                placeholder="Type a message…"
                className="flex-1 bg-white/10 rounded-[16px] px-4 py-2 text-white text-[15px] outline-none"
              />
              {!mainButtonSupported() && (
                <button
                  onClick={send}
                  disabled={!draft.trim()}
                  className="grad-tg text-white font-bold px-4 py-2 rounded-[16px] disabled:opacity-40"
                >
                  Send
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
