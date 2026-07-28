import { useEffect, useState } from 'react'
import { t } from '../i18n.js'
import { api } from '../api.js'
import { useAuthStore } from '../store.js'
import { PhotoGrid } from '../components/PhotoGrid.js'
import type { Photo } from '../components/PhotoGrid.js'
import type { UserProfile } from '../types.js'

export function MyProfile() {
  const { user: storeUser, setUser } = useAuthStore()
  const [profile, setProfile] = useState<UserProfile | null>(storeUser)

  useEffect(() => {
    api.profile.get().then((p) => { setProfile(p); setUser(p) })
  }, [])

  const refresh = async () => {
    const p = await api.profile.get()
    setProfile(p)
    setUser(p)
  }

  const handleUpload = async (file: File) => {
    await api.photos.upload(file)
    await refresh()
  }

  const handleDelete = async (photoId: string) => {
    await api.photos.delete(photoId)
    await refresh()
  }

  const handleReorder = async (orderedIds: string[]) => {
    await api.photos.reorder(orderedIds)
    await refresh()
  }

  if (!profile) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-pulse text-3xl">👤</div>
    </div>
  )

  const photos: Photo[] = profile.photos

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <h1 className="text-xl font-bold p-4 border-b">{t.profile.title}</h1>

      <div className="p-4">
        <h2 className="font-semibold mb-3">{t.profile.photos}</h2>
        <div className="mb-6">
          <PhotoGrid
            photos={photos}
            onUpload={handleUpload}
            onDelete={handleDelete}
            onReorder={handleReorder}
          />
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-gray-50">
            <p className="text-sm opacity-60">{t.profile.nameLabel}</p>
            <p className="font-semibold">{profile.name}</p>
          </div>
          <div className="p-4 rounded-2xl bg-gray-50">
            <p className="text-sm opacity-60">{t.profile.ageLabel}</p>
            <p className="font-semibold">{profile.age}</p>
          </div>
          <div className="p-4 rounded-2xl bg-gray-50">
            <p className="text-sm opacity-60">{t.profile.bioLabel}</p>
            <p className="font-semibold">{profile.bio ?? '—'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
