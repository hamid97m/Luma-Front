import type { Area } from 'react-easy-crop'

const QUALITY = 0.92

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image_load_failed'))
    img.src = url
  })
}

// Bounding-box size of an image rotated by `rotation` degrees.
function rotatedSize(width: number, height: number, rotation: number) {
  const rad = (rotation * Math.PI) / 180
  return {
    width: Math.abs(Math.cos(rad) * width) + Math.abs(Math.sin(rad) * height),
    height: Math.abs(Math.sin(rad) * width) + Math.abs(Math.cos(rad) * height),
  }
}

/**
 * Crop `file` to the pixel region `croppedAreaPixels` (in react-easy-crop's
 * displayed, EXIF-corrected coordinate space) after applying `rotation` degrees.
 * Returns a JPEG File. Does not resize/compress — that is compressImage's job.
 */
export async function cropImage(
  file: File,
  croppedAreaPixels: Area,
  rotation: number,
): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)

    // 1) Draw the rotated image onto a scratch canvas sized to its bounding box.
    const scratch = document.createElement('canvas')
    const sctx = scratch.getContext('2d')!
    const box = rotatedSize(image.width, image.height, rotation)
    scratch.width = box.width
    scratch.height = box.height
    sctx.translate(box.width / 2, box.height / 2)
    sctx.rotate((rotation * Math.PI) / 180)
    sctx.drawImage(image, -image.width / 2, -image.height / 2)

    // 2) Copy just the crop rectangle onto the output canvas.
    const data = sctx.getImageData(
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
    )
    const out = document.createElement('canvas')
    out.width = croppedAreaPixels.width
    out.height = croppedAreaPixels.height
    out.getContext('2d')!.putImageData(data, 0, 0)

    const blob = await new Promise<Blob>((resolve, reject) => {
      out.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('crop_failed'))),
        'image/jpeg',
        QUALITY,
      )
    })
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(url)
  }
}
