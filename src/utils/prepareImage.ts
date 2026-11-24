// Gets a picked file ready for the crop editor, before the editor shows it.
//
// Two things went wrong silently in signup (2026-11 funnel data: people picked
// a photo again and again and nothing was ever saved):
//  - a file the webview can't decode (HEIC on some phones, a broken file) left
//    the cropper blank, so "Use photo" did nothing;
//  - full-size camera photos (12MP+) cropped and rotated on a canvas can run
//    out of memory in Telegram's Android webview.
// So: decode it once here (with a timeout) and shrink it to MAX_EDIT_DIM. A
// failure rejects with a PrepareImageError the editor can show and report.

const MAX_EDIT_DIM = 2048
const LOAD_TIMEOUT_MS = 20_000
const QUALITY = 0.92

export type PrepareImageFailure = 'decode' | 'resize'

export class PrepareImageError extends Error {
  constructor(readonly reason: PrepareImageFailure) {
    super(`prepare_image_${reason}`)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const timer = setTimeout(() => {
      img.src = ''
      reject(new PrepareImageError('decode'))
    }, LOAD_TIMEOUT_MS)
    img.onload = () => {
      clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      clearTimeout(timer)
      reject(new PrepareImageError('decode'))
    }
    img.src = url
  })
}

/** The file to edit: the original when it's already small enough, otherwise a
 *  JPEG at most MAX_EDIT_DIM on its long side. Drawing an <img> applies EXIF
 *  orientation the same way the cropper and cropImage do. */
export async function prepareEditorImage(file: File): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const w = img.naturalWidth
    const h = img.naturalHeight
    if (!w || !h) throw new PrepareImageError('decode')

    const scale = Math.min(1, MAX_EDIT_DIM / Math.max(w, h))
    if (scale === 1) return file

    let blob: Blob | null = null
    try {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
      }
    } catch {
      blob = null
    }
    if (!blob) throw new PrepareImageError('resize')
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(url)
  }
}
