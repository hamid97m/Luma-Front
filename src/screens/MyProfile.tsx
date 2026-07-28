import { useEffect, useState } from 'react'
import { t } from '../i18n.js'
import { api } from '../api.js'
import { useAuthStore } from '../store.js'
import type { UserProfile } from '../types.js'

export function MyProfile() {
  const { user: storeUser, setUser } = useAuthStore()
  const [profile, setProfile] = useState<UserProfile | null>(storeUser)

  useEffect(() => {
    api.profile.get().then((p) => { setProfile(p); setUser(p) })
  }, [])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await api.photos.uploadFile(file)
    const p = await api.profile.get()
    setProfile(p)
    setUser(p)
  }

  const handleDeletePhoto = async (photoId: string) => {
    await api.photos.delete(photoId)
    const p = await api.profile.get()
    setProfile(p)
    setUser(p)
  }

  if (!profile) return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-3xl">👤</div></div>

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <h1 className="text-xl font-bold p-4 border-b">{t.profile.title}</h1>

      <div className="p-4">
        {/* Photos */}
        <h2 className="font-semibold mb-3">{t.profile.photos}</h2>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {profile.photos.map((photo) => (
            <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden" style={{ background: 'var(--tg-theme-secondary-bg-color)' }}>
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => handleDeletePhoto(photo.id)}
                className="absolute top-1 left-1 bg-black/50 text-white rounded-full w-6 h-6 text-xs"
              >
                ✕
              </button>
            </div>
          ))}
          {profile.photos.length < 6 && (
            <label className="aspect-square rounded-xl border-2 border-dashed flex items-center justify-center text-2xl cursor-pointer">
              +
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
          )}
        </div>

        {/* Profile info */}
        <div className="space-y-3">
          <div className="p-4 rounded-2xl" style={{ background: 'var(--tg-theme-secondary-bg-color)' }}>
            <p className="text-sm opacity-60">{t.profile.nameLabel}</p>
            <p className="font-semibold">{profile.name}</p>
          </div>
          <div className="p-4 rounded-2xl" style={{ background: 'var(--tg-theme-secondary-bg-color)' }}>
            <p className="text-sm opacity-60">{t.profile.ageLabel}</p>
            <p className="font-semibold">{profile.age}</p>
          </div>
          <div className="p-4 rounded-2xl" style={{ background: 'var(--tg-theme-secondary-bg-color)' }}>
            <p className="text-sm opacity-60">{t.profile.bioLabel}</p>
            <p className="font-semibold">{profile.bio ?? '—'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
