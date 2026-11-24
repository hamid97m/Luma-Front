import { useEffect } from 'react'
import { t } from '../../i18n.js'
import { subscribe } from '../../realtime.js'
import { useRequestsStore } from '../../store.js'
import { Avatar, Icon } from '../ui/index.js'

/** "Waiting for reply": the requests I sent that haven't been answered yet. */
export function SentRequestsSection({ refreshKey }: { refreshKey: number }) {
  const sent = useRequestsStore((s) => s.sent)
  const loadSent = useRequestsStore((s) => s.loadSent)

  useEffect(() => { loadSent() }, [refreshKey, loadSent])
  useEffect(() => subscribe((ev) => {
    if (ev.type === 'request' || ev.type === 'sync') loadSent()
  }), [loadSent])

  if (sent.length === 0) return null

  return (
    <div className="flex flex-col gap-2 px-4 pb-4">
      <h2 className="text-[13px] font-bold uppercase tracking-widest text-txt2 px-1">{t.requests.sentTitle}</h2>
      {sent.map((r) => (
        <div key={r.id} className="bg-surface rounded-m3-lg flex items-center gap-3 px-3.5 py-2">
          <Avatar src={r.user.photo} size={40} alt={r.user.name} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[14px] text-txt truncate">{r.user.name}</p>
            <p className="text-[13px] text-txt2 truncate">{r.body}</p>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-txt3 flex-none">
            <Icon name="clock" size={13} />
            {t.requests.waiting}
          </span>
        </div>
      ))}
    </div>
  )
}
