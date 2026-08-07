import { useState, useRef } from 'react'
import { Icon } from './ui/index.js'

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
  const [deletingId, setDeletingId] = useState<string | null>(null)
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

  const handleDelete = async (photoId: string) => {
    setDeletingId(photoId)
    try {
      await onDelete(photoId)
    } finally {
      setDeletingId(null)
    }
  }

  const handlePhotoTap = async (photo: Photo) => {
    if (deletingId) return
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
            className={`relative aspect-square rounded-m3-lg overflow-hidden bg-surface cursor-pointer ${
              selected === photo.id ? 'ring-2 ring-primary opacity-70' : ''
            }`}
            onClick={() => handlePhotoTap(photo)}
          >
            <img src={photo.url} alt={`Photo ${photo.id}`} className="w-full h-full object-cover" />
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(photo.id) }}
              disabled={deletingId === photo.id}
              aria-label="Delete photo"
              className="absolute top-1.5 left-1.5 text-white rounded-full w-6 h-6 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,.5)' }}
            >
              {deletingId === photo.id
                ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Icon name="x" size={11} strokeWidth={2.5} />}
            </button>
            {deletingId === photo.id && (
              <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.3)' }} />
            )}
          </div>
        ))}

        {uploading && (
          <div className="aspect-square rounded-m3-lg bg-surface flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!uploading && photos.length < maxPhotos && (
          <label className="aspect-square rounded-m3-lg border-2 border-dashed border-outline bg-bg flex items-center justify-center cursor-pointer text-primary">
            <Icon name="plus" size={22} />
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
        <div role="alert" className="text-sm text-error bg-error-container rounded-m3-md p-3 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss" className="ml-2 flex">
            <Icon name="x" size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  )
}
