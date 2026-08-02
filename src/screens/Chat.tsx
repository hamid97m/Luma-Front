import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import type { Match, Message } from '../types.js'

interface Props {
  match: Match
  myUserId: string
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

export function Chat({ match, myUserId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(false)
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

  const send = () => {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setSendError(false)
    api.messages.send(match.id, body)
      .then(({ message }) => {
        setMessages((prev) => [...prev, message])
        setDraft('')
      })
      .catch(() => setSendError(true))
      .finally(() => setSending(false))
  }

  const lastMineId = [...messages].reverse().find((m) => m.senderId === myUserId)?.id ?? null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0b0b12]">
        <img src="/luma-icon.png" alt="" className="w-14 h-14 rounded-2xl animate-pulse-heart select-none" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0b0b12]">
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
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[75%] px-4 py-2 rounded-[18px] text-[15px] ${
                  m.senderId === myUserId ? 'self-end grad-tg text-white' : 'self-start bg-white/10 text-white'
                }`}
              >
                <p>{m.body}</p>
                <p className="text-[10px] opacity-60 mt-0.5 flex items-center gap-1">
                  {formatTime(m.createdAt)}
                  {m.id === lastMineId && <SeenTicks seen={!!m.readAt} />}
                </p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div
            className="p-4 border-t border-white/10 flex flex-col gap-1"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
          >
            {sendError && <p role="alert" className="text-[12px] text-red-400">Couldn't send. Try again.</p>}
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send() }}
                placeholder="Type a message…"
                className="flex-1 bg-white/10 rounded-[16px] px-4 py-2 text-white text-[15px] outline-none"
              />
              <button
                onClick={send}
                disabled={!draft.trim() || sending}
                className="grad-tg text-white font-bold px-4 py-2 rounded-[16px] disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
