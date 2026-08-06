import { useEffect, useRef, useState } from 'react'
import { ProfileCard } from './ProfileCard.js'
import { PhotoViewer } from './PhotoViewer.js'
import { ReportSheet } from './ReportSheet.js'
import { haptic } from '../telegram.js'
import { t } from '../i18n.js'
import type { DiscoveryProfile } from '../types.js'

const THRESHOLD = 110

const HeartSVG = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)

const CrossSVG = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fb7185" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

interface Props {
  profiles: DiscoveryProfile[]
  onLike: () => void
  onPass: () => void
  disabled: boolean
  onGiftClick?: (profile: DiscoveryProfile) => void
}

export function CardStack({ profiles, onLike, onPass, disabled, onGiftClick }: Props) {
  const dragRef = useRef({ active: false, startX: 0, startY: 0, moved: false })
  const [offset, setOffset] = useState(0)
  const [flying, setFlying] = useState<'like' | 'pass' | null>(null)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [reportUserId, setReportUserId] = useState<string | null>(null)

  const profile = profiles[0]
  const nextProfile = profiles[1]

  // Preload photos for the current + upcoming cards so swiping never shows a blank/loading image.
  useEffect(() => {
    const urls = profiles.slice(0, 3).flatMap((p) => p.photos)
    urls.forEach((url) => {
      const img = new Image()
      img.src = url
    })
  }, [profiles])

  const likeOpacity = Math.min(1, Math.max(0, offset / THRESHOLD))
  const nopeOpacity = Math.min(1, Math.max(0, -offset / THRESHOLD))

  const fly = (dir: 'like' | 'pass') => {
    haptic.impact('medium')
    setFlying(dir)
    setTimeout(() => {
      setOffset(0)
      setFlying(null)
      setPhotoIdx(0)
      if (dir === 'like') onLike()
      else onPass()
    }, 300)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || flying) return
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.startX
    if (Math.abs(dx) > 5) dragRef.current.moved = true
    setOffset(dx)
  }

  // Tap zones on the photo: left/right 40% cycle photos, the middle opens the
  // fullscreen viewer. Handled here on pointerup (not via onClick in
  // ProfileCard) because setPointerCapture retargets the click event to this
  // wrapper, so child click handlers never fire in regular browsers.
  const handleTap = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (y > rect.height * 0.48) return
    if (x < rect.width * 0.4) handlePhotoTap('left')
    else if (x > rect.width * 0.6) handlePhotoTap('right')
    else if (profile?.photos.length) setViewerOpen(true)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    dragRef.current.active = false
    const dx = e.clientX - dragRef.current.startX
    if (Math.abs(dx) >= THRESHOLD) {
      fly(dx > 0 ? 'like' : 'pass')
    } else {
      setOffset(0)
      if (!dragRef.current.moved && !flying) handleTap(e)
    }
  }

  const cardStyle: React.CSSProperties = flying
    ? {
        transform: `translateX(${flying === 'like' ? '130%' : '-130%'}) rotate(${flying === 'like' ? 18 : -18}deg)`,
        opacity: 0,
        transition: 'transform .3s ease, opacity .3s ease',
      }
    : offset !== 0
      ? {
          transform: `translateX(${offset}px) rotate(${offset * 0.05}deg)`,
          transition: 'none',
          touchAction: 'pan-y',
        }
      : {
          transform: 'translateX(0) rotate(0deg)',
          transition: 'transform .3s cubic-bezier(.2,.8,.2,1)',
          touchAction: 'pan-y',
        }

  const handlePhotoTap = (side: 'left' | 'right') => {
    setPhotoIdx((i) =>
      side === 'left'
        ? Math.max(0, i - 1)
        : Math.min((profile?.photos.length ?? 1) - 1, i + 1)
    )
  }

  const handleGiftClick = () => {
    if (disabled || flying || !profile) return
    haptic.selection()
    onGiftClick?.(profile)
  }

  const handleReported = () => {
    setReportUserId(null)
    window.Telegram?.WebApp?.showAlert?.(t.report.thanks)
    // Advance past this card the same way the Pass button does — the user
    // is already auto-hidden server-side, this just clears the local queue.
    if (!disabled && !flying) fly('pass')
  }

  if (!profile) return null

  return (
    <div className="flex flex-col h-full px-4 pt-4 pb-2 gap-3">
      {/* Card area */}
      <div className="relative flex-1">
        {/* Peek card behind */}
        {nextProfile && (
          <div className="absolute inset-x-3 top-3 bottom-0 rounded-[32px] bg-white/10 -z-10" />
        )}

        {/* Top card — draggable */}
        <div
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          style={cardStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* LIKE stamp */}
          <div
            className="absolute top-8 left-6 z-20 text-emerald-400 font-extrabold text-3xl border-4 border-emerald-400 rounded-xl px-3 py-1 pointer-events-none"
            style={{ opacity: likeOpacity, transform: 'rotate(-16deg)' }}
          >
            LIKE
          </div>

          {/* NOPE stamp */}
          <div
            className="absolute top-8 right-6 z-20 text-rose-400 font-extrabold text-3xl border-4 border-rose-400 rounded-xl px-3 py-1 pointer-events-none"
            style={{ opacity: nopeOpacity, transform: 'rotate(16deg)' }}
          >
            NOPE
          </div>

          <ProfileCard
            profile={profile}
            photoIdx={photoIdx}
            onReport={() => !disabled && !flying && setReportUserId(profile.id)}
            onGiftClick={handleGiftClick}
          />
        </div>
      </div>

      {/* Hint */}
      <p className="text-center text-[11px] text-white/35 select-none">
        Swipe to like or pass · tap the photo to view it
      </p>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-8 pb-2">
        <button
          onClick={() => !disabled && !flying && fly('pass')}
          disabled={disabled}
          className="w-16 h-16 rounded-full glass-dark border border-white/20 flex items-center justify-center disabled:opacity-40"
          aria-label="Pass"
        >
          <CrossSVG />
        </button>

        <button
          onClick={() => !disabled && !flying && fly('like')}
          disabled={disabled}
          className="w-20 h-20 rounded-full flex items-center justify-center disabled:opacity-40"
          style={{
            background: 'linear-gradient(135deg,#f43f5e,#ec4067)',
            boxShadow: '0 16px 40px rgba(236,64,103,.6)',
          }}
          aria-label="Like"
        >
          <HeartSVG />
        </button>
      </div>

      {viewerOpen && (
        <PhotoViewer
          photos={profile.photos}
          initialIndex={photoIdx}
          alt={profile.name}
          onClose={(finalIdx) => {
            setViewerOpen(false)
            setPhotoIdx(finalIdx)
          }}
        />
      )}

      {reportUserId && (
        <ReportSheet
          reportedUserId={reportUserId}
          context="discovery"
          onClose={() => setReportUserId(null)}
          onSubmitted={handleReported}
        />
      )}
    </div>
  )
}
