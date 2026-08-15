import { useEffect, useRef, useState } from 'react'
import { ProfileCard } from './ProfileCard.js'
import { PhotoViewer } from './PhotoViewer.js'
import { ReportSheet } from './ReportSheet.js'
import { haptic } from '../telegram.js'
import { t } from '../i18n.js'
import { Icon } from './ui/index.js'
import type { DiscoveryProfile } from '../types.js'

const THRESHOLD = 110

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
    // 10px slop so natural finger jitter on touch devices still counts as a tap.
    if (Math.abs(dx) > 10) dragRef.current.moved = true
    setOffset(dx)
  }

  // A tap anywhere on the photo (above the info panel) opens the fullscreen
  // viewer; photo browsing happens inside it. Handled here on pointerup (not
  // via onClick in ProfileCard) because setPointerCapture retargets the click
  // event to this wrapper, so child click handlers never fire in regular
  // browsers.
  const handleTap = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    if (y > rect.height * 0.7) return
    if (!profile?.photos.length) return
    haptic.selection()
    setViewerOpen(true)
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
          <div className="absolute inset-x-3 top-3 bottom-0 rounded-m3-xl bg-surface-high -z-10" />
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
            className="absolute top-7 left-5 z-20 text-white font-bold text-[22px] tracking-wide rounded-xl px-4 py-1.5 pointer-events-none"
            style={{
              opacity: likeOpacity,
              transform: 'rotate(-10deg)',
              background: '#1B6B3A',
              boxShadow: '0 4px 12px rgba(0,0,0,.25)',
            }}
          >
            {t.discovery.like}
          </div>

          {/* PASS stamp */}
          <div
            className="absolute top-7 right-5 z-20 bg-destructive text-white font-bold text-[22px] tracking-wide rounded-xl px-4 py-1.5 pointer-events-none"
            style={{
              opacity: nopeOpacity,
              transform: 'rotate(10deg)',
              boxShadow: '0 4px 12px rgba(0,0,0,.25)',
            }}
          >
            {t.discovery.pass}
          </div>

          <ProfileCard
            key={profile.id}
            profile={profile}
            photoIdx={photoIdx}
            onReport={() => !disabled && !flying && setReportUserId(profile.id)}
            onGiftClick={handleGiftClick}
          />
        </div>
      </div>

      {/* Hint */}
      <p className="text-center text-[11px] text-txt3 select-none">
        {t.discovery.swipeHint}
      </p>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-6 pb-2">
        <button
          onClick={() => !disabled && !flying && fly('pass')}
          disabled={disabled}
          className="w-14 h-14 rounded-[18px] bg-surface text-txt2 shadow-m3-1 flex items-center justify-center disabled:opacity-40 hover:bg-surface-high transition-colors"
          aria-label={t.aria.pass}
        >
          <Icon name="x" size={24} strokeWidth={2.5} />
        </button>

        <button
          onClick={() => !disabled && !flying && fly('like')}
          disabled={disabled}
          className="w-[76px] h-[76px] rounded-[24px] bg-primary text-white shadow-m3-fab flex items-center justify-center disabled:opacity-40 hover:bg-primary-hover transition-colors"
          aria-label={t.aria.like}
        >
          <Icon name="heart" size={32} filled />
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
