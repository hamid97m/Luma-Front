import { t } from '../i18n.js'
import { ProfileCard } from './ProfileCard.js'
import type { DiscoveryProfile } from '../types.js'

interface Props {
  profiles: DiscoveryProfile[]
  onLike: () => void
  onPass: () => void
  disabled: boolean
}

export function CardStack({ profiles, onLike, onPass, disabled }: Props) {
  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Card area */}
      <div className="relative flex-1">
        {profiles.slice(0, 2).map((profile, i) => (
          <ProfileCard key={profile.id} profile={profile} isTop={i === 0} />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-4 justify-center pb-2">
        <button
          onClick={onPass}
          disabled={disabled || profiles.length === 0}
          className="flex-1 py-4 rounded-2xl text-lg font-semibold border-2 border-red-300 text-red-500 disabled:opacity-40"
          aria-label={t.discovery.pass}
        >
          ✕ {t.discovery.pass}
        </button>
        <button
          onClick={onLike}
          disabled={disabled || profiles.length === 0}
          className="flex-1 py-4 rounded-2xl text-lg font-semibold border-2 border-green-300 text-green-600 disabled:opacity-40"
          aria-label={t.discovery.like}
        >
          ❤️ {t.discovery.like}
        </button>
      </div>
    </div>
  )
}
