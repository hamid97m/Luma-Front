import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { t } from '../i18n.js'
import { haptic } from '../telegram.js'
import type { SupportTicketListItem, SupportMessage } from '../types.js'

type View =
  | { name: 'list' }
  | { name: 'new' }
  | { name: 'thread'; id: string }

export function Support({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>({ name: 'list' })

  // Telegram BackButton: go back within the overlay, or close it from the list.
  useEffect(() => {
    const bb = window.Telegram?.WebApp?.BackButton
    if (!bb) return
    const handler = () => {
      if (view.name === 'list') onClose()
      else setView({ name: 'list' })
    }
    bb.onClick(handler)
    bb.show()
    return () => { bb.offClick(handler); bb.hide() }
  }, [view, onClose])

  return (
    <div className="fixed inset-0 z-50 bg-[#0b0b12] flex flex-col" style={{ paddingTop: 'var(--tg-safe-top)' }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <button onClick={() => (view.name === 'list' ? onClose() : setView({ name: 'list' }))} className="text-white/70 text-xl">‹</button>
        <h1 className="text-white font-extrabold text-lg">{t.support.title}</h1>
      </div>
      {view.name === 'list' && <TicketList onOpen={(id) => setView({ name: 'thread', id })} onNew={() => setView({ name: 'new' })} />}
      {view.name === 'new' && <NewTicket onCreated={(id) => setView({ name: 'thread', id })} />}
      {view.name === 'thread' && <Thread id={view.id} />}
    </div>
  )
}

function TicketList({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const [tickets, setTickets] = useState<SupportTicketListItem[] | null>(null)

  useEffect(() => {
    api.support.list().then((d) => setTickets(d.tickets)).catch(() => setTickets([]))
  }, [])

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {tickets && tickets.length === 0 && <p className="text-white/50 text-sm text-center mt-8">{t.support.empty}</p>}
      {(tickets ?? []).map((tk) => (
        <button
          key={tk.id}
          onClick={() => onOpen(tk.id)}
          className="w-full text-left glass border border-white/12 rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/50">
              {tk.status === 'open' ? t.support.open : t.support.closed}
            </span>
            {tk.unread && <span className="w-2.5 h-2.5 rounded-full bg-[#ec4067]" />}
          </div>
          <p className="text-white/80 text-sm truncate">{tk.preview || '…'}</p>
        </button>
      ))}
      <button
        onClick={onNew}
        className="w-full py-3 rounded-2xl bg-[#ec4067] text-white font-bold sticky bottom-2"
      >
        {t.support.newTicket}
      </button>
    </div>
  )
}

function NewTicket({ onCreated }: { onCreated: (id: string) => void }) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!body.trim() || busy) return
    setBusy(true)
    try {
      const { ticket } = await api.support.create(body.trim())
      haptic.notification('success')
      onCreated(ticket.id)
    } catch (err) {
      setBusy(false)
      const msg = (err instanceof Error && err.message.includes('too_many_open_tickets'))
        ? t.support.tooMany : t.support.error
      window.Telegram?.WebApp?.showAlert?.(msg)
    }
  }

  return (
    <div className="flex-1 flex flex-col p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={6}
        placeholder={t.support.composePlaceholder}
        className="w-full rounded-2xl bg-white/5 border border-white/12 p-3 text-white placeholder:text-white/40"
      />
      <button
        onClick={submit}
        disabled={!body.trim() || busy}
        className="mt-4 w-full py-3 rounded-2xl bg-[#ec4067] text-white font-bold disabled:opacity-50"
      >
        {busy ? '…' : t.support.submit}
      </button>
    </div>
  )
}

function Thread({ id }: { id: string }) {
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api.support.thread(id).then((d) => setMessages(d.messages)).catch(() => {})
  useEffect(() => { load() }, [id])

  const send = async () => {
    if (!reply.trim() || busy) return
    setBusy(true)
    try {
      const { message } = await api.support.reply(id, reply.trim())
      setMessages((m) => [...m, message])
      setReply('')
    } catch {
      window.Telegram?.WebApp?.showAlert?.(t.support.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
              m.sender === 'user' ? 'bg-[#ec4067] text-white' : 'glass border border-white/12 text-white/90'
            }`}>
              {m.body}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 p-3 border-t border-white/10" style={{ paddingBottom: 'calc(0.75rem + var(--tg-safe-bottom, 0px))' }}>
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          maxLength={2000}
          placeholder={t.support.replyPlaceholder}
          className="flex-1 rounded-full bg-white/5 border border-white/12 px-4 text-white placeholder:text-white/40"
        />
        <button onClick={send} disabled={!reply.trim() || busy} className="px-5 rounded-full bg-[#ec4067] text-white font-bold disabled:opacity-50">
          {t.support.submit}
        </button>
      </div>
    </div>
  )
}
