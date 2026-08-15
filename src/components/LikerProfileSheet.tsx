import { t } from '../i18n.js'
import { relativeTime } from '../i18n/format.js'
import { useBackButton } from '../telegram.js'
import { Icon } from './ui/index.js'
import type { LikerProfile } from '../types.js'

interface Props {
  liker: LikerProfile
  busy: boolean
  onClose: () => void
  onPass: () => void
  onLikeBack: () => void
}

/** Full-screen liker profile (design "Liker profile" scene): photo header with a
 * "Liked you {when}" pill, name/age, location, bio, interest chips, and a
 * Pass / Like-back action row. Rendered above the tab bar. */
export function LikerProfileSheet({ liker, busy, onClose, onPass, onLikeBack }: Props) {
  // Telegram hardware back closes the overlay (pushes onto the shared back stack).
  useBackButton(true, onClose)

  const photo = liker.photos[0]

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-bg"
      style={{ paddingBottom: 'max(16px, var(--tg-safe-bottom))' }}
    >
      <div className="relative flex-none" style={{ height: 380 }}>
        {photo ? (
          <img src={photo} alt={liker.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-high">
            <Icon name="user" size={64} className="text-txt3" />
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg,rgba(0,0,0,.35) 0%,rgba(0,0,0,0) 34%,rgba(0,0,0,.6) 100%)' }}
        />
        <div className="absolute left-5 right-5 bottom-[18px]">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-primary text-[10.5px] font-bold uppercase tracking-wide mb-2"
            style={{ background: 'rgba(255,255,255,.92)' }}
          >
            <Icon name="heart" size={11} />
            {t.likes.likedYou(relativeTime(liker.likedAt))}
          </span>
          <h1 className="text-[28px] font-medium text-white m-0">
            {liker.name}
            {liker.age != null ? `, ${liker.age}` : ''}
          </h1>
          {liker.location && <p className="mt-0.5 text-[14px] text-white/85">{liker.location}</p>}
        </div>
      </div>

      <div className="p-5 flex flex-col gap-[18px]">
        {liker.bio && <p className="m-0 text-[15px] leading-relaxed text-txt">{liker.bio}</p>}
        {liker.interests.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {liker.interests.map((tag) => (
              <span key={tag} className="px-3.5 py-[7px] rounded-full bg-surface text-txt2 text-[13px]">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-3 pb-2">
          <button
            type="button"
            onClick={onPass}
            disabled={busy}
            aria-label={t.aria.pass}
            className="flex-none w-14 h-14 rounded-full bg-surface text-txt2 flex items-center justify-center transition-opacity disabled:opacity-60"
          >
            <Icon name="x" size={22} />
          </button>
          <button
            type="button"
            onClick={onLikeBack}
            disabled={busy}
            className="flex-1 h-14 rounded-[28px] bg-primary text-white text-[15px] font-medium flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
          >
            {busy ? (
              <span
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                style={{ animation: 'lumaSpin .8s linear infinite' }}
              />
            ) : (
              <>
                <Icon name="heart" size={19} />
                {t.likes.likeBack}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
