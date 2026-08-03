import { t } from '../../i18n.js'
import type { Match } from '../../types.js'

interface ChatEmptyStateProps {
  match: Match
  onPrefill: (text: string) => void
}

export function ChatEmptyState({ match, onPrefill }: ChatEmptyStateProps) {
  const { user } = match
  const matchedDate = new Date(match.matchedAt).toLocaleDateString([], { month: 'long', day: 'numeric' })

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-4 text-center overflow-y-auto">
      {user.photos[0]
        ? <img src={user.photos[0]} alt={user.name} className="w-24 h-24 rounded-full object-cover" />
        : <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-4xl">👤</div>}
      <div>
        <p className="text-white font-extrabold text-[19px]">{t.chat.matched(user.name)}</p>
        <p className="text-white/40 text-[13px] mt-1">{t.chat.matchedOn(matchedDate)}</p>
      </div>

      {user.icebreakerPrompt && user.icebreakerAnswer && (
        <div className="glass border border-white/15 rounded-2xl p-4 w-full max-w-xs text-left">
          <p className="text-white/50 text-[11px] font-bold uppercase tracking-widest mb-1">
            {t.chat.icebreakerOf(user.name)}
          </p>
          <p className="text-white/80 text-[13px]">{user.icebreakerPrompt}</p>
          <p className="text-white text-[15px] font-semibold mt-1">“{user.icebreakerAnswer}”</p>
          <button
            onClick={() => onPrefill(t.chat.icebreakerPrefill(user.icebreakerAnswer!))}
            className="mt-3 grad-accent text-white text-[13px] font-bold px-4 py-2 rounded-xl"
          >
            {t.chat.askAboutIt}
          </button>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {t.chat.openers.map((opener) => (
          <button
            key={opener}
            onClick={() => onPrefill(opener)}
            className="bg-white/10 text-white/80 text-[13px] px-3 py-2 rounded-full"
          >
            {opener}
          </button>
        ))}
      </div>
    </div>
  )
}
