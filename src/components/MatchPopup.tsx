import { t } from '../i18n.js'

interface MatchUser {
  id: string
  name: string
  telegramId: number
  photos?: string[]
}

interface Props {
  match: { id: string; user: MatchUser }
  onClose: () => void
}

export function MatchPopup({ match, onClose }: Props) {
  const photo = match.user.photos?.[0]
  const dmUrl = `tg://user?id=${match.user.telegramId}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="glass border border-white/15 rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
        {photo
          ? <img src={photo} alt={match.user.name} className="w-24 h-24 rounded-full object-cover mx-auto mb-4 ring-4 ring-white/20" />
          : <div className="text-5xl mb-4">💘</div>
        }

        <h2 className="text-2xl font-extrabold text-white mb-2">{t.match.title}</h2>
        <p className="text-white/60 mb-6 text-[15px]">{t.match.message(match.user.name)}</p>

        <a
          href={dmUrl}
          className="btn-primary flex items-center justify-center mb-3 no-underline"
          style={{ display: 'flex', textDecoration: 'none' }}
        >
          {t.match.send(match.user.name)}
        </a>

        <button
          onClick={onClose}
          className="w-full py-3 text-white/50 font-semibold"
        >
          {t.match.keepSwiping}
        </button>
      </div>
    </div>
  )
}
