// "My asks" — profiles she sent to friends and set aside. Tap one → its results,
// where she can go back to that profile.
import { t } from '../../i18n.js'
import { relativeTime } from '../../i18n/format.js'
import { haptic } from '../../telegram.js'
import { Avatar, Icon, Sheet } from '../ui/index.js'
import type { AskSummary } from '../../types.js'
import { verdictLabel } from './askUtils.js'

interface Props {
  open: boolean
  asks: AskSummary[]
  onClose: () => void
  onOpen: (ask: AskSummary) => void
}

export function AskListSheet({ open, asks, onClose, onOpen }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={t.ask.listTitle}>
      <div className="flex flex-col gap-3 pb-2" data-testid="ask-list">
        <p className="text-[13px] text-txt2">{t.ask.listSub}</p>
        {asks.length === 0 ? (
          <p className="text-[14px] text-txt2 text-center py-6">{t.ask.listEmpty}</p>
        ) : (
          <div className="flex flex-col rounded-m3-md bg-surface overflow-hidden">
            {asks.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => { haptic.selection(); onOpen(a) }}
                className="flex items-center gap-3 px-3.5 py-2.5 min-h-[64px] border-b border-outline last:border-b-0 text-start hover:bg-surface-high transition-colors"
              >
                <Avatar src={a.targetPhotoUrl} alt={a.targetName} size={44} />
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[15px] font-medium text-txt truncate">{a.targetName}</span>
                  <span className={`text-[12px] ${a.answered > 0 ? 'text-primary font-medium' : 'text-txt2'}`}>
                    {a.answered > 0
                      ? t.ask.badgeTally(a.yes, a.total, verdictLabel(a.question, 'yes'))
                      : `${t.ask.badgeWaiting} · ${relativeTime(a.createdAt)}`}
                  </span>
                </span>
                <Icon name="chevron-right" size={18} className="rtl:-scale-x-100 text-txt3 flex-none" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  )
}
