import { useEffect, useRef, useState } from 'react'
import { haptic } from '../telegram.js'

interface Props {
  photos: string[]
  initialIndex: number
  alt: string
  /** Called with the index the viewer was on, so the card can stay in sync. */
  onClose: (finalIndex: number) => void
}

const MAX_SCALE = 4
const DOUBLE_TAP_SCALE = 2.5
const DOUBLE_TAP_MS = 350
const DOUBLE_TAP_SLOP = 40

interface GestureState {
  mode: 'swipe' | 'pan' | 'pinch' | null
  startX: number
  startY: number
  moved: boolean
  startTx: number
  startTy: number
  startScale: number
  startDist: number
  startMidX: number
  startMidY: number
}

export function PhotoViewer({ photos, initialIndex, alt, onClose }: Props) {
  const [idx, setIdx] = useState(initialIndex)
  const [offset, setOffset] = useState(0)
  // Zoom state for the current photo: scale + translation of its center.
  const [zoom, setZoom] = useState({ scale: 1, tx: 0, ty: 0 })
  const [gesturing, setGesturing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const gesture = useRef<GestureState>({
    mode: null, startX: 0, startY: 0, moved: false,
    startTx: 0, startTy: 0, startScale: 1, startDist: 0, startMidX: 0, startMidY: 0,
  })
  const lastTap = useRef({ t: 0, x: 0, y: 0 })

  const zoomRef = useRef(zoom)
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  const idxRef = useRef(idx)
  useEffect(() => { idxRef.current = idx }, [idx])

  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

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

  const size = () => {
    const el = containerRef.current
    return el ? { w: el.clientWidth, h: el.clientHeight } : { w: window.innerWidth, h: window.innerHeight }
  }

  // Keep the pan within the photo area so the image can't be flung off-screen.
  const clampZoom = (scale: number, tx: number, ty: number) => {
    const { w, h } = size()
    const maxTx = ((scale - 1) * w) / 2
    const maxTy = ((scale - 1) * h) / 2
    return {
      scale,
      tx: Math.max(-maxTx, Math.min(maxTx, tx)),
      ty: Math.max(-maxTy, Math.min(maxTy, ty)),
    }
  }

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(photos.length - 1, next))
    if (clamped !== idx) haptic.selection()
    setIdx(clamped)
    setZoom({ scale: 1, tx: 0, ty: 0 })
  }

  const toggleDoubleTapZoom = (x: number, y: number) => {
    haptic.impact('light')
    if (zoomRef.current.scale > 1) {
      setZoom({ scale: 1, tx: 0, ty: 0 })
    } else {
      const { w, h } = size()
      // Zoom in around the tapped point: the content under the finger stays put.
      const tx = -(DOUBLE_TAP_SCALE - 1) * (x - w / 2)
      const ty = -(DOUBLE_TAP_SCALE - 1) * (y - h / 2)
      setZoom(clampZoom(DOUBLE_TAP_SCALE, tx, ty))
    }
  }

  const firstTwo = () => {
    const [a, b] = [...pointers.current.values()]
    return { a, b }
  }

  const beginPinch = () => {
    const { a, b } = firstTwo()
    const g = gesture.current
    const z = zoomRef.current
    g.mode = 'pinch'
    g.startDist = Math.hypot(b.x - a.x, b.y - a.y)
    g.startMidX = (a.x + b.x) / 2
    g.startMidY = (a.y + b.y) / 2
    g.startScale = z.scale
    g.startTx = z.tx
    g.startTy = z.ty
    setOffset(0)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setGesturing(true)
    const g = gesture.current
    if (pointers.current.size === 2) {
      beginPinch()
      return
    }
    if (pointers.current.size === 1) {
      g.moved = false
      g.startX = e.clientX
      g.startY = e.clientY
      if (zoomRef.current.scale > 1) {
        g.mode = 'pan'
        g.startTx = zoomRef.current.tx
        g.startTy = zoomRef.current.ty
      } else {
        g.mode = 'swipe'
      }
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current

    if (g.mode === 'pinch' && pointers.current.size >= 2) {
      const { a, b } = firstTwo()
      const dist = Math.hypot(b.x - a.x, b.y - a.y)
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      const rawScale = g.startScale * (dist / g.startDist)
      const scale = Math.max(0.7, Math.min(MAX_SCALE, rawScale))
      const { w, h } = size()
      const cx = w / 2
      const cy = h / 2
      // Keep the content point that was under the pinch midpoint under it.
      const ratio = scale / g.startScale
      const tx = midX - cx - ratio * (g.startMidX - cx - g.startTx)
      const ty = midY - cy - ratio * (g.startMidY - cy - g.startTy)
      setZoom({ scale, tx, ty })
      return
    }

    if (g.mode === 'pan') {
      const dx = e.clientX - g.startX
      const dy = e.clientY - g.startY
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) g.moved = true
      setZoom(clampZoom(zoomRef.current.scale, g.startTx + dx, g.startTy + dy))
      return
    }

    if (g.mode === 'swipe') {
      let dx = e.clientX - g.startX
      if (Math.abs(dx) > 10) g.moved = true
      // Rubber-band resistance at the ends.
      if ((idx === 0 && dx > 0) || (idx === photos.length - 1 && dx < 0)) dx *= 0.3
      setOffset(dx)
    }
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.delete(e.pointerId)
    const g = gesture.current

    if (g.mode === 'pinch') {
      if (pointers.current.size >= 2) {
        beginPinch() // re-anchor to the remaining pair
        return
      }
      // Pinch ended: snap under-zoom back to 1:1.
      const z = zoomRef.current
      if (z.scale <= 1.05) setZoom({ scale: 1, tx: 0, ty: 0 })
      else setZoom(clampZoom(z.scale, z.tx, z.ty))
      if (pointers.current.size === 1) {
        // Finger still down — continue as a pan.
        const p = [...pointers.current.values()][0]
        g.mode = 'pan'
        g.startX = p.x
        g.startY = p.y
        g.moved = true
        g.startTx = zoomRef.current.tx
        g.startTy = zoomRef.current.ty
        return
      }
      g.mode = null
      setGesturing(false)
      return
    }

    if (pointers.current.size > 0) return

    if (g.mode === 'swipe') {
      const dx = e.clientX - g.startX
      const width = size().w
      if (Math.abs(dx) > width * 0.2) goTo(idx + (dx < 0 ? 1 : -1))
      setOffset(0)
    }

    // Tap / double-tap detection (works from both swipe and pan modes).
    if (!g.moved) {
      const now = Date.now()
      const lt = lastTap.current
      if (now - lt.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < DOUBLE_TAP_SLOP) {
        lastTap.current = { t: 0, x: 0, y: 0 }
        toggleDoubleTapZoom(e.clientX, e.clientY)
      } else {
        lastTap.current = { t: now, x: e.clientX, y: e.clientY }
      }
    }

    g.mode = null
    setGesturing(false)
  }

  const zoomed = zoom.scale > 1

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Full-screen swipeable photo strip — bars overlay it, so the image
          centers on the actual screen like Telegram's media viewer. */}
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="absolute inset-0 flex"
          style={{
            transform: `translateX(calc(${-idx * 100}% + ${offset}px))`,
            transition: gesturing ? 'none' : 'transform .25s cubic-bezier(.2,.8,.2,1)',
          }}
        >
          {photos.map((url, i) => (
            <div key={i} className="w-full h-full flex-shrink-0 flex items-center justify-center overflow-hidden">
              <img
                src={url}
                alt={alt}
                className="max-w-full max-h-full object-contain pointer-events-none"
                draggable={false}
                style={
                  i === idx
                    ? {
                        transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})`,
                        transition: gesturing ? 'none' : 'transform .25s cubic-bezier(.2,.8,.2,1)',
                      }
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      </div>

      {/* Top bar: counter + close, overlaid with a legibility gradient */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pb-3"
        style={{
          paddingTop: 'calc(var(--tg-safe-top) + 12px)',
          background: 'linear-gradient(to bottom, rgba(0,0,0,.6), transparent)',
        }}
      >
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

      {/* Telegram-style bottom thumbnail pager (hidden while zoomed in) */}
      {photos.length > 1 && !zoomed && (
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1.5 pt-3 px-4 overflow-x-auto"
          style={{
            paddingBottom: 'calc(var(--tg-safe-bottom) + 12px)',
            background: 'linear-gradient(to top, rgba(0,0,0,.6), transparent)',
          }}
        >
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
