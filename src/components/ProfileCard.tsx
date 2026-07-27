import type { DiscoveryProfile } from '../types.js'

interface Props {
  profile: DiscoveryProfile
  isTop: boolean
}

export function ProfileCard({ profile, isTop }: Props) {
  const photo = profile.photos[0]

  return (
    <div
      className={`absolute inset-0 rounded-3xl overflow-hidden shadow-xl transition-transform ${isTop ? 'z-10' : 'z-0 scale-95 opacity-60'}`}
      style={{ background: photo ? `url(${photo}) center/cover` : '#e8e8e8' }}
    >
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent text-white">
        <h2 className="text-2xl font-bold">
          <span>{profile.name}</span>
          <span>، {profile.age}</span>
        </h2>
        {profile.bio && <p className="mt-1 opacity-90 text-sm line-clamp-2">{profile.bio}</p>}
      </div>
    </div>
  )
}
