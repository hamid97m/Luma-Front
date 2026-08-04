import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { IntrosSection } from '../components/gifts/IntrosSection.js'
import type { Match } from '../types.js'

const PaperPlaneSVG = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
)

function formatDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString()
}

function isNewMatch(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000
}

interface Props {
  onOpenChat: (match: Match) => void
  refreshKey: number
}

export function Matches({ onOpenChat, refreshKey }: Props) {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // On silent refreshes (refreshKey bump) a failure just keeps the stale list.
    api.matches.list()
      .then(({ matches: m }) => setMatches(m))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [refreshKey])

  // Accepting an intro only returns a matchId, so it may not be in the
  // already-loaded list (it's a brand-new match). Reuse the same
  // api.matches.list() + onOpenChat navigation the "Chat" button below uses,
  // refetching first if the match isn't found locally yet.
  const openChatById = (matchId: string) => {
    const local = matches.find((m) => m.id === matchId)
    if (local) {
      onOpenChat(local)
      return
    }
    api.matches.list()
      .then(({ matches: fresh }) => {
        setMatches(fresh)
        const found = fresh.find((m) => m.id === matchId)
        if (found) onOpenChat(found)
      })
      .catch(() => {})
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <img src="/luma-icon.png" alt="" className="w-14 h-14 rounded-2xl animate-pulse-heart select-none" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <h1 className="text-2xl font-extrabold px-5 pt-12 pb-5 text-white">
        Matches 💬
      </h1>

      <IntrosSection onOpenChat={openChatById} refreshKey={refreshKey} />

      {matches.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center p-8">
          <div className="text-[72px]">💫</div>
          <h2 className="text-xl font-extrabold text-white">No matches yet</h2>
          <p className="text-[15px] text-white/50">Keep swiping to find your match!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 pb-6">
          {matches.map((match) => (
            <div
              key={match.id}
              className="glass border border-white/12 rounded-[24px] shadow-2xl flex items-center gap-4 p-4"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {match.user.photos[0]
                  ? <img
                      src={match.user.photos[0]}
                      alt={match.user.name}
                      className="w-16 h-16 rounded-full object-cover ring-2 ring-white/20"
                    />
                  : <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl ring-2 ring-white/20">
                      👤
                    </div>
                }
                {isNewMatch(match.matchedAt) && (
                  <span
                    className="absolute -top-1 -right-1 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full"
                    style={{ background: 'linear-gradient(90deg,#f43f5e,#ec4067)' }}
                  >
                    NEW
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[18px] text-white truncate">{match.user.name}</p>
                <p className="text-[14px] text-white/55 truncate">
                  {match.lastMessage ? match.lastMessage.body : 'Say hi! 👋'}
                </p>
              </div>

              {/* Time + unread */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <p className="text-[11px] text-white/40">
                  {formatDate(match.lastMessage ? match.lastMessage.createdAt : match.matchedAt)}
                </p>
                {match.unreadCount > 0 && (
                  <span
                    className="text-white text-[11px] font-extrabold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(90deg,#f43f5e,#ec4067)' }}
                  >
                    {match.unreadCount}
                  </span>
                )}
              </div>

              {/* Chat button */}
              <button
                onClick={() => onOpenChat(match)}
                className="grad-tg text-white text-[14px] font-bold px-4 py-2 rounded-[16px] flex items-center gap-2 flex-shrink-0"
                style={{ boxShadow: '0 8px 22px rgba(0,136,204,.45)' }}
              >
                <PaperPlaneSVG />
                Chat
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
