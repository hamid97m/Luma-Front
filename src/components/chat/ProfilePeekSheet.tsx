import { t } from '../../i18n.js'
import type { Match } from '../../types.js'

interface ProfilePeekSheetProps {
  user: Match['user']
  onClose: () => void
  onReport: () => void
  onSendGift?: () => void
}

export function ProfilePeekSheet({ user, onClose, onReport, onSendGift }: ProfilePeekSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="glass border border-white/15 rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[75vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold text-white">
            {user.name}
            {user.age != null && <span className="text-white/60 font-bold">, {user.age}</span>}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReport}
              aria-label={t.report.title}
              className="w-8 h-8 rounded-full glass-dark flex items-center justify-center text-[14px] text-white/80"
            >
              🚩
            </button>
            <button onClick={onClose} aria-label="Close" className="text-white/50 text-2xl leading-none">✕</button>
          </div>
        </div>

        {user.photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto mb-4">
            {user.photos.map((url) => (
              <img key={url} src={url} alt={user.name} className="w-32 h-40 rounded-2xl object-cover flex-shrink-0" />
            ))}
          </div>
        )}

        {user.bio && <p className="text-white/80 text-[14px] mb-4">{user.bio}</p>}

        {user.icebreakerPrompt && user.icebreakerAnswer && (
          <div className="border border-white/15 rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,.06)' }}>
            <p className="text-white/50 text-[11px] font-bold uppercase tracking-widest mb-1">{user.icebreakerPrompt}</p>
            <p className="text-white text-[14px]">{user.icebreakerAnswer}</p>
          </div>
        )}

        {onSendGift && (
          <button
            type="button"
            onClick={onSendGift}
            className="w-full rounded-2xl bg-white/10 border border-white/15 py-3 text-white font-semibold text-[14px] flex items-center justify-center gap-2"
          >
            {t.gifts.openButton} 🎁
          </button>
        )}
      </div>
    </div>
  )
}
