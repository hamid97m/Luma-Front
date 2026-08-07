import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { t } from '../i18n.js'
import { haptic, useBackButton } from '../telegram.js'
import { Button, Icon, IconButton, Textarea } from '../components/ui/index.js'
import type { SupportTicketListItem, SupportMessage } from '../types.js'

type View =
  | { name: 'list' }
  | { name: 'new' }
  | { name: 'thread'; id: string }

export function Support({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>({ name: 'list' })

  // Telegram back-press: go back within the overlay, or close it from the list.
  useBackButton(true, () => {
    if (view.name === 'list') onClose()
    else setView({ name: 'list' })
  })

  return (
    <div className="fixed inset-0 z-50 bg-bg text-txt flex flex-col" style={{ paddingTop: 'var(--tg-safe-top)' }}>
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

  if (!tickets) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span
          className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full"
          style={{ animation: 'lumaSpin .8s linear infinite' }}
        />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
      {tickets.length === 0 && <TicketsEmpty />}
      {tickets.map((tk) => (
        <button
          key={tk.id}
          onClick={() => onOpen(tk.id)}
          className="w-full text-left bg-surface rounded-m3-lg p-4 transition-colors hover:bg-surface-high"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[11px] font-bold uppercase tracking-widest ${tk.status === 'open' ? 'text-primary' : 'text-txt3'}`}>
              {tk.status === 'open' ? t.support.open : t.support.closed}
            </span>
            {tk.unread && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
          </div>
          <p className="text-txt text-sm truncate">{tk.preview || '…'}</p>
        </button>
      ))}
      <Button variant="filled" block icon="plus" onClick={onNew} className="sticky bottom-2 mt-1">
        {t.support.newTicket}
      </Button>
    </div>
  )
}

// "No tickets yet" empty state — matches the Luma Material mockup: a bobbing
// message tile with a floating check badge, then heading and reassurance copy.
function TicketsEmpty() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6 pt-6 pb-8">
      <div className="relative w-[120px] h-[120px] flex items-center justify-center flex-none mb-1">
        <div
          className="w-[84px] h-[84px] rounded-m3-xl bg-primary-container text-primary flex items-center justify-center"
          style={{ animation: 'lumaBob 3.2s ease-in-out infinite' }}
        >
          <Icon name="message-dots" size={36} />
        </div>
        <span
          className="absolute top-[10px] right-[14px] w-[26px] h-[26px] rounded-full bg-surface text-txt2 flex items-center justify-center"
          style={{ animation: 'lumaBob 2.8s ease-in-out 1.2s infinite' }}
        >
          <Icon name="check" size={14} />
        </span>
      </div>
      <h2 className="text-[20px] font-medium text-txt">{t.support.emptyTitle}</h2>
      <p className="text-txt2 text-[14px] leading-relaxed max-w-[230px]">{t.support.empty}</p>
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
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={6}
        placeholder={t.support.composePlaceholder}
      />
      <Button variant="filled" block onClick={submit} disabled={!body.trim() || busy} className="mt-4">
        {busy ? '…' : t.support.submit}
      </Button>
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
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-m3-lg px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
              m.sender === 'user' ? 'bg-primary text-white' : 'bg-surface text-txt'
            }`}>
              {m.body}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 pt-2.5 bg-surface flex-none" style={{ paddingBottom: 'calc(0.75rem + var(--tg-safe-bottom, 0px))' }}>
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          maxLength={2000}
          placeholder={t.support.replyPlaceholder}
          className="flex-1 h-11 rounded-full bg-field text-txt px-4 outline-none border border-transparent focus:border-primary transition-colors placeholder:text-txt3"
        />
        <IconButton icon="send" tone="primary" size={44} iconSize={18} aria-label={t.support.submit} onClick={send} disabled={!reply.trim() || busy} />
      </div>
    </div>
  )
}
