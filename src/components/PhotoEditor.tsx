import { useEffect, useMemo, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import { cropImage } from '../utils/cropImage.js'
import { prepareEditorImage, PrepareImageError, type PrepareImageFailure } from '../utils/prepareImage.js'
import { useBackButton } from '../telegram.js'
import { t } from '../i18n.js'
import { Button } from './ui/index.js'

export interface PhotoEditorProps {
  file: File
  onCancel: () => void
  onConfirm: (edited: File) => void
  /** Reported once per failure, for signup telemetry. 'decode'/'resize': the
   *  picked file couldn't be opened; 'crop': "Use photo" failed. */
  onError?: (reason: PrepareImageFailure | 'crop') => void
}

type Prepared = { status: 'loading' } | { status: 'ready'; file: File } | { status: 'failed' }

function haptic() {
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
}

export function PhotoEditor({ file, onCancel, onConfirm, onError }: PhotoEditorProps) {
  const [prepared, setPrepared] = useState<Prepared>({ status: 'loading' })
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  // Decode + shrink before showing the cropper: an undecodable file used to
  // leave a blank cropper whose "Use photo" silently did nothing.
  useEffect(() => {
    let cancelled = false
    setPrepared({ status: 'loading' })
    prepareEditorImage(file).then(
      (ready) => { if (!cancelled) setPrepared({ status: 'ready', file: ready }) },
      (err: unknown) => {
        if (cancelled) return
        setPrepared({ status: 'failed' })
        onErrorRef.current?.(err instanceof PrepareImageError ? err.reason : 'decode')
      },
    )
    return () => { cancelled = true }
  }, [file])

  const editFile = prepared.status === 'ready' ? prepared.file : null
  const imageSrc = useMemo(() => (editFile ? URL.createObjectURL(editFile) : null), [editFile])
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [areaPixels, setAreaPixels] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => { if (imageSrc) URL.revokeObjectURL(imageSrc) }, [imageSrc])

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
    if (!editFile || !areaPixels || busy) return
    setBusy(true)
    setError(null)
    try {
      haptic()
      const edited = await cropImage(editFile, areaPixels, rotation)
      onConfirm(edited)
    } catch {
      onErrorRef.current?.('crop')
      const msg = t.photoEditor.error
      setError(msg)
      window.Telegram?.WebApp?.showAlert?.(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1">
        {imageSrc ? (
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
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-white/90 text-[15px]">
            {prepared.status === 'failed'
              ? <p role="alert">{t.photoEditor.loadFailed}</p>
              : <p>{t.photoEditor.preparing}</p>}
          </div>
        )}
      </div>

      <div className="bg-bg rounded-t-m3-xl" style={{ paddingBottom: 'calc(8px + var(--tg-safe-bottom))' }}>
        {error && (
          <p role="alert" className="px-5 pt-4 text-center text-sm text-error">
            {error}
          </p>
        )}

        {prepared.status === 'failed' ? (
          <div className="flex justify-center px-5 py-4">
            <Button type="button" variant="filled" onClick={onCancel}>
              {t.photoEditor.pickAnother}
            </Button>
          </div>
        ) : (
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <Button
            type="button"
            variant="text"
            onClick={onCancel}
            disabled={busy}
          >
            {t.photoEditor.cancel}
          </Button>

          <Button
            type="button"
            variant="tonal"
            icon="rotate-ccw"
            onClick={rotate}
            disabled={busy || !imageSrc}
            aria-label={t.photoEditor.rotateAria}
          >
            {t.photoEditor.rotate}
          </Button>

          <Button
            type="button"
            variant="filled"
            onClick={confirm}
            disabled={busy || !areaPixels}
          >
            {busy ? t.photoEditor.saving : t.photoEditor.use}
          </Button>
        </div>
        )}
      </div>
    </div>
  )
}
