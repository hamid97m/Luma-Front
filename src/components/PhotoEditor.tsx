import { useEffect, useMemo, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import { cropImage } from '../utils/cropImage.js'
import { useBackButton } from '../telegram.js'
import { Button } from './ui/index.js'

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

  // Map a back-press to Cancel while the editor is open. Ignores presses while
  // a crop is in flight so a back-press can't unmount the editor out from under
  // an in-progress confirm() that would still call onConfirm.
  useBackButton(true, () => {
    if (busyRef.current) return
    onCancelRef.current()
  })

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

      <div className="bg-bg rounded-t-m3-xl" style={{ paddingBottom: 'calc(8px + var(--tg-safe-bottom))' }}>
        {error && (
          <p role="alert" className="px-5 pt-4 text-center text-sm text-error">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <Button
            type="button"
            variant="text"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="tonal"
            icon="rotate-ccw"
            onClick={rotate}
            disabled={busy}
            aria-label="Rotate 90 degrees"
          >
            Rotate
          </Button>

          <Button
            type="button"
            variant="filled"
            onClick={confirm}
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Use photo'}
          </Button>
        </div>
      </div>
    </div>
  )
}
