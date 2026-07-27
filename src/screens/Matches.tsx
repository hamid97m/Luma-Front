import { useEffect, useState } from 'react'
import { t } from '../i18n.js'
import { api } from '../api.js'
import type { Match } from '../types.js'

export function Matches() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.matches.list().then(({ matches }) => {
      setMatches(matches)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-3xl">💬</div></div>

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <div className="text-5xl">💔</div>
        <h2 className="text-xl font-bold">{t.matches.empty}</h2>
        <p className="opacity-60">{t.matches.emptyHint}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <h1 className="text-xl font-bold p-4 border-b">{t.matches.title}</h1>
      <div className="flex-1 overflow-y-auto">
        {matches.map((match) => (
          <div key={match.id} className="flex items-center gap-4 p-4 border-b">
            <div
              className="w-14 h-14 rounded-full bg-gray-200 bg-cover bg-center flex-shrink-0"
              style={match.user.photos[0] ? { backgroundImage: `url(${match.user.photos[0]})` } : {}}
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{match.user.name}</p>
            </div>
            <a
              href={`tg://user?id=${match.user.telegramId}`}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }}
            >
              {t.matches.message}
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
