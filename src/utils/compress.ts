const MAX_DIM = 1200
const QUALITY = 0.85

function readExifOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer)
  if (view.byteLength < 2 || view.getUint16(0) !== 0xffd8) return 1
  let offset = 2
  while (offset < view.byteLength - 4) {
    const marker = view.getUint16(offset)
    offset += 2
    if (marker === 0xffe1) {
      const segLen = view.getUint16(offset)
      if (
        offset + 10 < view.byteLength &&
        view.getUint32(offset + 2) === 0x45786966  // 'Exif'
      ) {
        const tiff = offset + 8
        const le = view.getUint16(tiff) === 0x4949
        const ifd = view.getUint32(tiff + 4, le)
        const entries = view.getUint16(tiff + ifd, le)
        for (let i = 0; i < entries; i++) {
          const e = tiff + ifd + 2 + i * 12
          if (e + 10 > view.byteLength) break
          if (view.getUint16(e, le) === 0x0112) {
            return view.getUint16(e + 8, le)
          }
        }
      }
      offset += segLen
    } else if ((marker & 0xff00) === 0xff00) {
      if (offset + 2 > view.byteLength) break
      offset += view.getUint16(offset)
    } else {
      break
    }
  }
  return 1
}

function applyOrientation(
  ctx: CanvasRenderingContext2D,
  orientation: number,
  sw: number,
  sh: number,
) {
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, sw, 0); break
    case 3: ctx.transform(-1, 0, 0, -1, sw, sh); break
    case 4: ctx.transform(1, 0, 0, -1, 0, sh); break
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break
    case 6: ctx.transform(0, 1, -1, 0, sh, 0); break
    case 7: ctx.transform(0, -1, -1, 0, sh, sw); break
    case 8: ctx.transform(0, -1, 1, 0, 0, sw); break
  }
}

function readAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer()
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = reject
    reader.readAsArrayBuffer(blob)
  })
}

export async function compressImage(file: File): Promise<Blob> {
  const headerBuf = await readAsArrayBuffer(file.slice(0, 65536))
  const orientation = readExifOrientation(headerBuf)

  const bitmap = await createImageBitmap(file)
  const { width: bw, height: bh } = bitmap

  const scale = Math.min(1, MAX_DIM / Math.max(bw, bh))
  const sw = Math.round(bw * scale)
  const sh = Math.round(bh * scale)

  const swapped = orientation >= 5
  const canvas = document.createElement('canvas')
  canvas.width  = swapped ? sh : sw
  canvas.height = swapped ? sw : sh

  const ctx = canvas.getContext('2d')!
  applyOrientation(ctx, orientation, sw, sh)
  ctx.drawImage(bitmap, 0, 0, sw, sh)
  bitmap.close?.()

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('compression_failed'))),
      'image/jpeg',
      QUALITY,
    )
  })
}
