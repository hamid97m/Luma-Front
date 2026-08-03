import { useEffect } from 'react'
import { t } from '../i18n.js'
import { haptic } from '../telegram.js'

interface MatchUser {
  id: string
  name: string
  telegramId: number
  username: string | null
  photos?: string[]
}

interface Props {
  match: { id: string; user: MatchUser }
  onClose: () => void
  onMessage: () => void
}

export function MatchPopup({ match, onClose, onMessage }: Props) {
  const photo = match.user.photos?.[0]

  // Celebrate the match with a success buzz when the popup appears.
  useEffect(() => { haptic.notification('success') }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="glass border border-white/15 rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
        {photo
          ? <img src={photo} alt={match.user.name} className="w-24 h-24 rounded-full object-cover mx-auto mb-4 ring-4 ring-white/20" />
          : <div className="text-5xl mb-4">💘</div>
        }

        <h2 className="text-2xl font-extrabold text-white mb-2">{t.match.title}</h2>
        <p className="text-white/60 mb-6 text-[15px]">{t.match.message(match.user.name)}</p>

        <button
          onClick={onMessage}
          className="btn-primary flex items-center justify-center mb-3 no-underline w-full"
        >
          {t.match.send(match.user.name)}
        </button>

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
