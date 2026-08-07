import { t } from '../../i18n.js'
import { Sheet, Button, Icon } from '../ui/index.js'
import type { Match } from '../../types.js'

interface ProfilePeekSheetProps {
  user: Match['user']
  onClose: () => void
  onReport: () => void
  onSendGift?: () => void
}

export function ProfilePeekSheet({ user, onClose, onReport, onSendGift }: ProfilePeekSheetProps) {
  return (
    <Sheet open onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[22px] font-medium text-txt">
          {user.name}
          {user.age != null && <span className="text-txt2 font-normal">, {user.age}</span>}
        </h2>
        <button
          type="button"
          onClick={onReport}
          aria-label={t.report.title}
          className="w-10 h-10 rounded-full bg-surface text-txt2 flex items-center justify-center flex-none transition-colors hover:bg-surface-high"
        >
          <Icon name="flag" size={15} />
        </button>
      </div>

      {user.photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto mb-4">
          {user.photos.map((url) => (
            <img key={url} src={url} alt={user.name} className="w-32 h-40 rounded-m3-md object-cover flex-none" />
          ))}
        </div>
      )}

      {user.bio && <p className="text-txt2 text-[14px] leading-relaxed mb-4">{user.bio}</p>}

      {user.icebreakerPrompt && user.icebreakerAnswer && (
        <div className="bg-primary-container rounded-m3-lg p-4 mb-4">
          <p className="text-on-primary-container opacity-70 text-[11px] font-bold uppercase tracking-widest mb-1">{user.icebreakerPrompt}</p>
          <p className="text-on-primary-container text-[14px]">{user.icebreakerAnswer}</p>
        </div>
      )}

      {onSendGift && (
        <Button variant="tonal" block icon="gift" onClick={onSendGift}>
          {t.gifts.openButton}
        </Button>
      )}
    </Sheet>
  )
}
