import type { DiscoveryProfile } from '../types.js'

const VerifiedSVG = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#2ea6ff" className="inline ml-1 flex-shrink-0">
    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#2ea6ff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

interface Props {
  profile: DiscoveryProfile
  photoIdx: number
  onPhotoTap: (side: 'left' | 'right') => void
  dragMoved: () => boolean
}

export function ProfileCard({ profile, photoIdx, onPhotoTap, dragMoved }: Props) {
  const photo = profile.photos[photoIdx] ?? profile.photos[0]
  const hasLeft = photoIdx > 0
  const hasRight = photoIdx < profile.photos.length - 1

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragMoved()) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (y > rect.height * 0.48) return
    if (x < rect.width * 0.4) onPhotoTap('left')
    else if (x > rect.width * 0.6) onPhotoTap('right')
  }

  return (
    <div className="absolute inset-0 rounded-[32px] overflow-hidden select-none" onClick={handleClick}>
      {/* Photo */}
      {photo
        ? <img src={photo} alt={profile.name} className="w-full h-full object-cover pointer-events-none" draggable={false} />
        : <div className="w-full h-full bg-white/10" />
      }

      {/* Photo pager segment bars */}
      {profile.photos.length > 1 && (
        <div className="absolute top-3 left-3 right-3 flex gap-1 pointer-events-none">
          {profile.photos.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i === photoIdx ? 'bg-white' : 'bg-white/35'}`}
            />
          ))}
        </div>
      )}

      {/* Chevron hints */}
      {hasLeft && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-white/70 text-2xl pointer-events-none">‹</div>
      )}
      {hasRight && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 text-2xl pointer-events-none">›</div>
      )}

      {/* Distance pill */}
      <div className="absolute top-10 left-3 glass-dark rounded-full text-[12px] px-3 py-1 text-white/90 pointer-events-none">
        📍 nearby
      </div>

      {/* Dark overlay gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.3) 40%, transparent 65%)' }}
      />

      {/* Glass info panel */}
      <div className="absolute bottom-3 left-3 right-3 glass border border-white/20 rounded-[26px] p-4 pointer-events-none">
        {/* Interest pills */}
        {profile.interests.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {profile.interests.slice(0, 3).map((tag) => (
              <span key={tag} className="glass-dark rounded-full text-[12px] px-3 py-1 text-white/90">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Name + age */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[30px] font-extrabold text-white leading-none">{profile.name}</span>
          <span className="text-[24px] font-light text-white/90">{profile.age}</span>
          <VerifiedSVG />
        </div>

        {/* Tagline · city */}
        {(profile.bio || profile.location) && (
          <p className="text-[14px] text-white/85 mt-1 line-clamp-2">
            {[profile.bio, profile.location].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>
  )
}
