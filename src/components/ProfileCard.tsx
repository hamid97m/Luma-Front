import type { DiscoveryProfile } from '../types.js'
import { t } from '../i18n.js'
import { Icon } from './ui/index.js'

interface Props {
  profile: DiscoveryProfile
  photoIdx: number
  onReport: () => void
  onGiftClick: () => void
}

// Purely presentational — photo cycling and viewer-opening taps are handled
// by CardStack on the draggable wrapper (see handleTap there).
export function ProfileCard({ profile, photoIdx, onReport, onGiftClick }: Props) {
  const photo = profile.photos[photoIdx] ?? profile.photos[0]

  return (
    <div className="absolute inset-0 rounded-m3-xl overflow-hidden select-none shadow-m3-1 bg-surface-high">
      {/* Photo — keyed by URL so React mounts a fresh <img> per photo instead of
          reusing the element and repainting the previously-decoded bitmap until
          the new src decodes (which flashed the previous profile after a swipe). */}
      {photo
        ? <img key={photo} src={photo} alt={profile.name} className="w-full h-full object-cover pointer-events-none" draggable={false} />
        : <div className="w-full h-full bg-surface-high" />
      }

      {/* Photo pager segment bars */}
      {profile.photos.length > 1 && (
        <div className="absolute top-3.5 left-3.5 right-3.5 flex gap-1 pointer-events-none">
          {profile.photos.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i === photoIdx ? 'bg-white' : 'bg-white/35'}`}
            />
          ))}
        </div>
      )}

      {/* Distance pill */}
      <div
        className="absolute top-8 start-3.5 flex items-center gap-1.5 rounded-m3-sm text-[12px] font-medium px-2.5 py-1.5 text-white pointer-events-none"
        style={{ background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(8px)' }}
      >
        <Icon name="map-pin" size={12} strokeWidth={2.5} />
        {t.discovery.nearby}
      </div>

      {/* Report trigger */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onReport() }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={t.report.title}
        className="absolute top-8 end-3.5 w-9 h-9 rounded-full flex items-center justify-center text-white pointer-events-auto"
        style={{ background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(8px)' }}
      >
        <Icon name="flag" size={15} />
      </button>

      {/* Send-a-gift trigger */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onGiftClick() }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={t.gifts.openButton}
        className="absolute top-8 end-[56px] w-9 h-9 rounded-full flex items-center justify-center text-white pointer-events-auto"
        style={{ background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(8px)' }}
      >
        <Icon name="gift" size={15} />
      </button>

      {/* Dark overlay gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,.72) 0%, rgba(0,0,0,.25) 38%, transparent 62%)' }}
      />

      {/* Info panel */}
      <div className="absolute bottom-0 left-0 right-0 p-5 pointer-events-none">
        {/* Interest pills */}
        {profile.interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {profile.interests.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-m3-sm text-[12px] font-medium px-2.5 py-1.5 text-white"
                style={{ background: 'rgba(255,255,255,.22)', backdropFilter: 'blur(8px)' }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Name + age */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[32px] font-medium text-white leading-none">{profile.name}</span>
          <span className="text-[26px] font-normal text-white/90">{profile.age}</span>
          <Icon name="verified" size={18} className="text-primary self-center flex-shrink-0" />
        </div>

        {/* Tagline · city */}
        {(profile.bio || profile.location) && (
          <p className="text-[14px] text-white/[.88] mt-1.5 line-clamp-2">
            {[profile.bio, profile.location].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>
  )
}
