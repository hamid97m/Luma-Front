import { t } from '../../i18n.js'
import { formatLongDate } from '../../i18n/format.js'
import { Avatar, Button, Chip } from '../ui/index.js'
import type { Match } from '../../types.js'

interface ChatEmptyStateProps {
  match: Match
  onPrefill: (text: string) => void
}

export function ChatEmptyState({ match, onPrefill }: ChatEmptyStateProps) {
  const { user } = match
  const matchedDate = formatLongDate(new Date(match.matchedAt))

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-4 text-center overflow-y-auto">
      <Avatar src={user.photos[0]} alt={user.name} size={96} />
      <div>
        <p className="text-txt font-medium text-[20px]">{t.chat.matched(user.name)}</p>
        <p className="text-txt3 text-[13px] mt-1">{t.chat.matchedOn(matchedDate)}</p>
      </div>

      {user.icebreakerPrompt && user.icebreakerAnswer && (
        <div className="bg-primary-container rounded-m3-lg p-4 w-full max-w-xs text-start">
          <p className="text-on-primary-container text-[11px] font-bold uppercase tracking-widest mb-1 opacity-70">
            {t.chat.icebreakerOf(user.name)}
          </p>
          <p className="text-on-primary-container text-[13px] opacity-90">{user.icebreakerPrompt}</p>
          <p className="text-on-primary-container text-[15px] font-medium mt-1">“{user.icebreakerAnswer}”</p>
          <Button
            variant="filled"
            size="sm"
            className="mt-3"
            onClick={() => onPrefill(t.chat.icebreakerPrefill(user.icebreakerAnswer!))}
          >
            {t.chat.askAboutIt}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {t.chat.openers.map((opener) => (
          <Chip key={opener} onClick={() => onPrefill(opener)}>
            {opener}
          </Chip>
        ))}
      </div>
    </div>
  )
}
