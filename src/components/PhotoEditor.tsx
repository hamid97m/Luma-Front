import { useEffect, useMemo, useState } from 'react'
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

  useEffect(() => () => URL.revokeObjectURL(imageSrc), [imageSrc])

  // Map the Telegram BackButton to Cancel while the editor is open.
  useEffect(() => {
    const back = window.Telegram?.WebApp?.BackButton
    if (!back) return
    back.onClick(onCancel)
    back.show()
    return () => {
      back.offClick(onCancel)
      back.hide()
    }
  }, [onCancel])

  const rotate = () => {
    haptic()
    setRotation((r) => (r + 90) % 360)
  }

  const confirm = async () => {
    if (!areaPixels || busy) return
    setBusy(true)
    try {
      haptic()
      const edited = await cropImage(file, areaPixels, rotation)
      onConfirm(edited)
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
