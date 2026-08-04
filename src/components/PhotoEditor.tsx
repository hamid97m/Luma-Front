import { useEffect, useMemo, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import { cropImage } from '../utils/cropImage.js'

export interface PhotoEditorProps {
  file: File
  onCancel: () => void
  onConfirm: (edited: File) => void
}

function haptic() {
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
}

export function PhotoEditor({ file, onCancel, onConfirm }: PhotoEditorProps) {
  const imageSrc = useMemo(() => URL.createObjectURL(file), [file])
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [areaPixels, setAreaPixels] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => URL.revokeObjectURL(imageSrc), [imageSrc])

  // Keep the latest onCancel/busy accessible to the BackButton handler
  // below without re-subscribing on every render.
  const onCancelRef = useRef(onCancel)
  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])

  const busyRef = useRef(busy)
  useEffect(() => {
    busyRef.current = busy
  }, [busy])

  // Map the Telegram BackButton to Cancel while the editor is open. Registered
  // once (not per-render) so it doesn't churn, and ignores presses while a
  // crop is in flight so a back-press can't unmount the editor out from under
  // an in-progress confirm() that would still call onConfirm.
  useEffect(() => {
    const back = window.Telegram?.WebApp?.BackButton
    if (!back) return
    const handleBack = () => {
      if (busyRef.current) return
      onCancelRef.current()
    }
    back.onClick(handleBack)
    back.show()
    return () => {
      back.offClick(handleBack)
      back.hide()
    }
  }, [])

  const rotate = () => {
    haptic()
    setRotation((r) => (r + 90) % 360)
  }

  const confirm = async () => {
    if (!areaPixels || busy) return
    setBusy(true)
    setError(null)
    try {
      haptic()
      const edited = await cropImage(file, areaPixels, rotation)
      onConfirm(edited)
    } catch {
      const msg = 'Could not process this photo. Please try again.'
      setError(msg)
      window.Telegram?.WebApp?.showAlert?.(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={(_area, pixels) => setAreaPixels(pixels)}
        />
      </div>

      {error && (
        <p role="alert" className="px-5 py-2 text-center text-sm text-rose-400 bg-black">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 px-5 py-4 bg-black">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-4 py-2 rounded-full text-white/80 text-sm font-semibold glass-dark"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={rotate}
          disabled={busy}
          aria-label="Rotate 90 degrees"
          className="px-4 py-2 rounded-full text-white text-sm font-semibold glass-dark"
        >
          ↻ Rotate
        </button>

        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="px-5 py-2 rounded-full text-white text-sm font-bold"
          style={{ background: 'linear-gradient(90deg,#f43f5e,#ec4067)' }}
        >
          {busy ? 'Saving…' : 'Use photo'}
        </button>
      </div>
    </div>
  )
}
