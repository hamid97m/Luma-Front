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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
        {photo && (
          <div
            className="w-24 h-24 rounded-full mx-auto mb-4 bg-cover bg-center"
            style={{ backgroundImage: `url(${photo})` }}
          />
        )}
        {!photo && <div className="text-5xl mb-4">💘</div>}

        <h2 className="text-2xl font-bold mb-2">{t.match.title}</h2>
        <p className="opacity-70 mb-6">{t.match.message(match.user.name)}</p>

        <a
          href={dmUrl}
          className="block w-full py-4 rounded-2xl font-semibold mb-3"
          style={{ background: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }}
        >
          {t.match.send(match.user.name)}
        </a>

        <button
          onClick={onClose}
          className="w-full py-3 opacity-60 font-semibold"
        >
          {t.match.keepSwiping}
        </button>
      </div>
    </div>
  )
}
