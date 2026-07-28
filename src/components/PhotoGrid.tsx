import { useState, useRef } from 'react'

export type Photo = { id: string; url: string; position: number }

export interface PhotoGridProps {
  photos: Photo[]
  onUpload: (file: File) => Promise<void>
  onDelete: (photoId: string) => Promise<void>
  onReorder: (orderedIds: string[]) => Promise<void>
  maxPhotos?: number
}

const MAX_FILE_SIZE = 20 * 1024 * 1024

export function PhotoGrid({
  photos,
  onUpload,
  onDelete,
  onReorder,
  maxPhotos = 6,
}: PhotoGridProps) {
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (inputRef.current) inputRef.current.value = ''

    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Image must be smaller than 20MB')
      return
    }

    setError(null)
    setUploading(true)
    try {
      await onUpload(file)
    } catch {
      setError('Upload failed — please try again')
    } finally {
      setUploading(false)
    }
  }

  const handlePhotoTap = async (photo: Photo) => {
    if (selected === null) {
      setSelected(photo.id)
      return
    }
    if (selected === photo.id) {
      setSelected(null)
      return
    }
    const sorted = [...photos].sort((a, b) => a.position - b.position)
    const aIdx = sorted.findIndex((p) => p.id === selected)
    const bIdx = sorted.findIndex((p) => p.id === photo.id)
    ;[sorted[aIdx], sorted[bIdx]] = [sorted[bIdx], sorted[aIdx]]
    setSelected(null)
    await onReorder(sorted.map((p) => p.id))
  }

  const sorted = [...photos].sort((a, b) => a.position - b.position)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {sorted.map((photo) => (
          <div
            key={photo.id}
            className={`relative aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer ${
              selected === photo.id ? 'ring-2 ring-blue-500 opacity-70' : ''
            }`}
            onClick={() => handlePhotoTap(photo)}
          >
            <img src={photo.url} alt={`Photo ${photo.id}`} className="w-full h-full object-cover" />
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(photo.id) }}
              className="absolute top-1 left-1 bg-black/50 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        ))}

        {uploading && (
          <div className="aspect-square rounded-xl bg-gray-100 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!uploading && photos.length < maxPhotos && (
          <label className="aspect-square rounded-xl border-2 border-dashed flex items-center justify-center text-2xl cursor-pointer text-gray-400">
            +
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        )}
      </div>

      {error && (
        <div role="alert" className="text-sm text-red-500 bg-red-50 rounded-xl p-3 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 font-bold">✕</button>
        </div>
      )}
    </div>
  )
}
