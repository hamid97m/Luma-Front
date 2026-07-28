import { useState, useEffect } from 'react'
import { t } from '../i18n.js'
import { api } from '../api.js'
import { PhotoGrid } from '../components/PhotoGrid.js'
import type { Photo } from '../components/PhotoGrid.js'

type Step = 'age' | 'gender' | 'lookingFor' | 'photos' | 'bio'
const STEPS: Step[] = ['age', 'gender', 'lookingFor', 'photos', 'bio']
const STORAGE_KEY = 'profile_setup'

interface SetupState {
  age: string
  gender: 'man' | 'woman'
  looking_for: 'men' | 'women' | 'both'
  bio: string
}

interface Props {
  onComplete: () => void
}

export function ProfileSetup({ onComplete }: Props) {
  const [stepIdx, setStepIdx] = useState(0)
  const [form, setForm] = useState<SetupState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : { age: '', gender: 'man', looking_for: 'women', bio: '' }
  })
  const [photos, setPhotos] = useState<Photo[]>([])
  const [saving, setSaving] = useState(false)

  const step = STEPS[stepIdx]

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
  }, [form])

  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))

  const handleUpload = async (file: File) => {
    const photo = await api.photos.upload(file)
    setPhotos((prev) => [...prev, photo])
  }

  const handleDelete = async (photoId: string) => {
    await api.photos.delete(photoId)
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
  }

  const handleReorder = async (orderedIds: string[]) => {
    await api.photos.reorder(orderedIds)
    setPhotos((prev) => {
      const byId = Object.fromEntries(prev.map((p) => [p.id, p]))
      return orderedIds.map((id, i) => ({ ...byId[id], position: i }))
    })
  }

  const finish = async () => {
    setSaving(true)
    try {
      await api.profile.update({
        age: Number(form.age),
        gender: form.gender,
        looking_for: form.looking_for,
        bio: form.bio || null,
      })
      localStorage.removeItem(STORAGE_KEY)
      onComplete()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      window.Telegram?.WebApp?.showAlert?.(`Error: ${msg}`)
      console.error('finish error:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-screen p-6">
      <div className="flex gap-1 mb-8">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full"
            style={{ background: i <= stepIdx ? 'var(--tg-theme-button-color)' : '#e0e0e0' }}
          />
        ))}
      </div>

      <div className="flex-1">
        {step === 'age' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">{t.setup.yourAge}</h2>
            <input
              type="number" min={18} max={99}
              value={form.age}
              onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
              className="w-full p-4 text-xl border-2 rounded-2xl text-center"
              placeholder="۲۵"
            />
            <button
              onClick={next}
              disabled={!form.age || Number(form.age) < 18}
              className="w-full py-4 rounded-2xl font-semibold disabled:opacity-40"
              style={{ background: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }}
            >
              {t.next}
            </button>
          </div>
        )}

        {step === 'gender' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">{t.setup.yourGender}</h2>
            {(['man', 'woman'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setForm((f) => ({ ...f, gender: g }))}
                className={`w-full py-4 rounded-2xl font-semibold border-2 ${form.gender === g ? 'border-blue-500' : 'border-gray-200'}`}
              >
                {g === 'man' ? t.setup.man : t.setup.woman}
              </button>
            ))}
            <button
              onClick={next}
              className="w-full py-4 rounded-2xl font-semibold"
              style={{ background: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }}
            >
              {t.next}
            </button>
          </div>
        )}

        {step === 'lookingFor' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">{t.setup.lookingFor}</h2>
            {([['men', t.setup.lookingForMen], ['women', t.setup.lookingForWomen], ['both', t.setup.lookingForBoth]] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setForm((f) => ({ ...f, looking_for: val }))}
                className={`w-full py-4 rounded-2xl font-semibold border-2 ${form.looking_for === val ? 'border-blue-500' : 'border-gray-200'}`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={next}
              className="w-full py-4 rounded-2xl font-semibold"
              style={{ background: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }}
            >
              {t.next}
            </button>
          </div>
        )}

        {step === 'photos' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">{t.setup.addPhotos}</h2>
            <p className="opacity-60">{t.setup.photosHint}</p>
            <PhotoGrid
              photos={photos}
              onUpload={handleUpload}
              onDelete={handleDelete}
              onReorder={handleReorder}
            />
            <button
              onClick={next}
              disabled={photos.length === 0}
              className="w-full py-4 rounded-2xl font-semibold disabled:opacity-40"
              style={{ background: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }}
            >
              {t.next}
            </button>
          </div>
        )}

        {step === 'bio' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">{t.setup.bio}</h2>
            <textarea
              rows={4}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              className="w-full p-4 border-2 rounded-2xl resize-none"
              placeholder={t.setup.bioPlaceholder}
            />
            <button
              onClick={finish}
              disabled={saving}
              className="w-full py-4 rounded-2xl font-semibold disabled:opacity-40"
              style={{ background: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }}
            >
              {saving ? '...' : t.setup.done}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
