import { useEffect, useRef, useState } from 'react'
import { haptic } from '../telegram.js'

interface Props {
  photos: string[]
  initialIndex: number
  alt: string
  /** Called with the index the viewer was on, so the card can stay in sync. */
  onClose: (finalIndex: number) => void
}

export function PhotoViewer({ photos, initialIndex, alt, onClose }: Props) {
  const [idx, setIdx] = useState(initialIndex)
  const [offset, setOffset] = useState(0)
  const dragRef = useRef({ active: false, startX: 0 })
  const widthRef = useRef<HTMLDivElement>(null)

  const idxRef = useRef(idx)
  useEffect(() => {
    idxRef.current = idx
  }, [idx])

  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Map the Telegram BackButton to closing the viewer while it's open.
  useEffect(() => {
    const back = window.Telegram?.WebApp?.BackButton
    if (!back) return
    const handleBack = () => onCloseRef.current(idxRef.current)
    back.onClick(handleBack)
    back.show()
    return () => {
      back.offClick(handleBack)
      back.hide()
    }
  }, [])

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(photos.length - 1, next))
    if (clamped !== idx) haptic.selection()
    setIdx(clamped)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { active: true, startX: e.clientX }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    let dx = e.clientX - dragRef.current.startX
    // Rubber-band resistance at the ends.
    if ((idx === 0 && dx > 0) || (idx === photos.length - 1 && dx < 0)) dx *= 0.3
    setOffset(dx)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    dragRef.current.active = false
    const dx = e.clientX - dragRef.current.startX
    const width = widthRef.current?.clientWidth ?? window.innerWidth
    if (Math.abs(dx) > width * 0.2) goTo(idx + (dx < 0 ? 1 : -1))
    setOffset(0)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      style={{ paddingTop: 'var(--tg-safe-top)', paddingBottom: 'var(--tg-safe-bottom)' }}
    >
      {/* Top bar: counter + close */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3">
        <span className="text-[14px] text-white/80 font-semibold">
          {photos.length > 1 ? `${idx + 1} of ${photos.length}` : ''}
        </span>
        <button
          type="button"
          onClick={() => onClose(idx)}
          aria-label="Close"
          className="w-9 h-9 rounded-full glass-dark flex items-center justify-center text-white/90 text-[18px]"
        >
          ✕
        </button>
      </div>

      {/* Swipeable photo strip */}
      <div
        ref={widthRef}
        className="relative flex-1 overflow-hidden touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="absolute inset-0 flex"
          style={{
            transform: `translateX(calc(${-idx * 100}% + ${offset}px))`,
            transition: dragRef.current.active ? 'none' : 'transform .25s cubic-bezier(.2,.8,.2,1)',
          }}
        >
          {photos.map((url, i) => (
            <div key={i} className="w-full h-full flex-shrink-0 flex items-center justify-center">
              <img
                src={url}
                alt={alt}
                className="max-w-full max-h-full object-contain pointer-events-none"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Telegram-style bottom thumbnail pager */}
      {photos.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-3 px-4 overflow-x-auto">
          {photos.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Photo ${i + 1}`}
              className="flex-shrink-0 rounded-lg overflow-hidden transition-all duration-200"
              style={{
                width: i === idx ? 40 : 28,
                height: 40,
                border: i === idx ? '2px solid #fff' : '2px solid transparent',
                opacity: i === idx ? 1 : 0.6,
              }}
            >
              <img src={url} alt="" className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
