import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { IntrosSection } from '../components/gifts/IntrosSection.js'
import { Avatar, Badge, Icon } from '../components/ui/index.js'
import { MatchesEmpty } from '../components/MatchesEmpty.js'
import { haptic } from '../telegram.js'
import type { Match } from '../types.js'

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
  onStartDiscovering: () => void
  refreshKey: number
}

export function Matches({ onOpenChat, onStartDiscovering, refreshKey }: Props) {
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
    <div className="flex flex-col h-full overflow-y-auto bg-bg text-txt pt-6">
      <IntrosSection onOpenChat={openChatById} refreshKey={refreshKey} />

      {matches.length === 0 ? (
        <MatchesEmpty onStartDiscovering={onStartDiscovering} />
      ) : (
        <div className="flex flex-col gap-2 px-4 pb-6">
          {matches.map((match) => (
            <button
              key={match.id}
              type="button"
              onClick={() => { haptic.selection(); onOpenChat(match) }}
              aria-label={`Open chat with ${match.user.name}`}
              className="w-full text-left bg-surface rounded-m3-lg flex items-center gap-3 px-3.5 py-3 transition-colors active:brightness-95"
            >
              {/* Avatar */}
              <div className="relative flex-none">
                <Avatar src={match.user.photos[0]} alt={match.user.name} size={56} />
                {isNewMatch(match.matchedAt) && (
                  <span className="absolute -top-1 -right-1.5 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary">
                    NEW
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[16px] text-txt truncate">{match.user.name}</p>
                <p className="text-[13px] text-txt2 truncate">
                  {match.lastMessage ? match.lastMessage.body : 'Say hi!'}
                </p>
              </div>

              {/* Time + unread */}
              <div className="flex flex-col items-end gap-1 flex-none">
                <p className="text-[11px] text-txt3">
                  {formatDate(match.lastMessage ? match.lastMessage.createdAt : match.matchedAt)}
                </p>
                {match.unreadCount > 0 && <Badge>{match.unreadCount}</Badge>}
              </div>

              {/* Chevron cue */}
              <Icon name="chevron-right" size={20} className="text-txt3 flex-none" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
