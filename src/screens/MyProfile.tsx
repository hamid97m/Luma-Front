import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuthStore } from '../store.js'
import type { UserProfile } from '../types.js'
import { SettingsSheet } from '../components/SettingsSheet.js'
import { PhotoEditor } from '../components/PhotoEditor.js'

const ALL_TAGS = [
  '☕ Coffee', '✈️ Travel', '🎵 Music', '🎨 Art',
  '📚 Reading', '🥾 Hiking', '🍳 Cooking', '🎬 Film',
  '🐕 Dogs', '🏄 Surfing', '💃 Dancing', '🎸 Guitar',
  '🍷 Wine', '🧘 Yoga', '📷 Photography', '🎮 Gaming',
]

const PROMPTS = [
  'My ideal Sunday…',
  'Two truths and a lie…',
  'The way to win me over is…',
  'I geek out about…',
  'A perfect first date…',
  'My most controversial opinion…',
]

const SLOT_IDS = ['p', 'a', 'b', 'c', 'd', 'e'] as const

const VerifiedSVG = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2ea6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline ml-1">
    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
)

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass border border-white/12 rounded-[24px] p-4">
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest mb-1">{children}</p>
  )
}

export function MyProfile() {
  const { user: storeUser, setUser } = useAuthStore()
  const [profile, setProfile] = useState<UserProfile | null>(storeUser)

  // Editable field states
  const [name, setName] = useState(storeUser?.name ?? '')
  const [age, setAge] = useState(String(storeUser?.age ?? ''))
  const [location, setLocation] = useState(storeUser?.location ?? '')
  const [bio, setBio] = useState(storeUser?.bio ?? '')
  const [tags, setTags] = useState<string[]>(storeUser?.interests ?? [])
  const [tagPicker, setTagPicker] = useState(false)
  const [prompt, setPrompt] = useState(storeUser?.icebreaker_prompt ?? PROMPTS[0])
  const [answer, setAnswer] = useState(storeUser?.icebreaker_answer ?? '')
  const [uploading, setUploading] = useState<{ slotId: string; phase: 'processing' | 'uploading'; progress: number } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editing, setEditing] = useState<{ file: File; slotId: string } | null>(null)

  useEffect(() => {
    api.profile.get().then((p) => {
      setProfile(p)
      setUser(p)
      setName(p.name)
      setAge(String(p.age))
      setLocation(p.location ?? '')
      setBio(p.bio ?? '')
      setTags(p.interests)
      setPrompt(p.icebreaker_prompt ?? PROMPTS[0])
      setAnswer(p.icebreaker_answer ?? '')
    })
  }, [])

  const save = (updates: Partial<Parameters<typeof api.profile.update>[0]>) =>
    api.profile.update(updates).catch(() => {})

  const removeTag = (tag: string) => {
    const next = tags.filter((t) => t !== tag)
    setTags(next)
    save({ interests: next })
  }

  const addTag = (tag: string) => {
    if (tags.includes(tag)) return
    const next = [...tags, tag]
    setTags(next)
    save({ interests: next })
  }

  const handlePhotoUpload = async (file: File, slotId: string) => {
    setUploading({ slotId, phase: 'processing', progress: 0 })
    try {
      await api.photos.upload(file, (progress) => setUploading({ slotId, phase: 'uploading', progress }))
      const p = await api.profile.get()
      setProfile(p)
      setUser(p)
    } finally {
      setUploading(null)
    }
  }

  const handlePhotoDelete = async (photoId: string) => {
    await api.photos.delete(photoId)
    const p = await api.profile.get()
    setProfile(p)
    setUser(p)
  }

  const setPrimaryPhoto = async (photoId: string) => {
    if (!profile) return
    const order = [...profile.photos].sort((a, b) => a.position - b.position).map((p) => p.id)
    if (order[0] === photoId) return
    const nextOrder = [photoId, ...order.filter((id) => id !== photoId)]

    const byId = new Map(profile.photos.map((p) => [p.id, p]))
    const reordered = { ...profile, photos: nextOrder.map((id, i) => ({ ...byId.get(id)!, position: i })) }
    setProfile(reordered)
    setUser(reordered)

    try {
      await api.photos.reorder(nextOrder)
    } catch {
      const p = await api.profile.get()
      setProfile(p)
      setUser(p)
    }
  }

  const handlePauseChange = (nextIsActive: boolean) => {
    if (!profile) return
    const updated = { ...profile, is_active: nextIsActive }
    setProfile(updated)
    setUser(updated)
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <img src="/luma-icon.png" alt="" className="w-14 h-14 rounded-2xl animate-pulse-heart select-none" />
      </div>
    )
  }

  const photos = profile.photos.sort((a, b) => a.position - b.position)

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-6">
      <div className="flex items-center justify-between px-5 pt-12 pb-5">
        <h1 className="text-2xl font-extrabold text-white">My Profile 👤</h1>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="text-2xl text-white/60"
        >
          ⚙️
        </button>
      </div>

      <div className="flex flex-col gap-4 px-4">

        {/* Photo grid */}
        <div className="photo-grid">
          {SLOT_IDS.map((slotId, i) => {
            const photo = photos[i]
            return (
              <div key={slotId} className={`slot-${slotId} relative rounded-2xl overflow-hidden`}>
                {photo ? (
                  <>
                    <img
                      src={photo.url}
                      alt=""
                      onClick={() => setPrimaryPhoto(photo.id)}
                      className="w-full h-full object-cover cursor-pointer"
                    />
                    {slotId === 'p' && (
                      <span className="absolute bottom-2 left-2 glass-dark text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Primary
                      </span>
                    )}
                    <button
                      onClick={() => handlePhotoDelete(photo.id)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </>
                ) : uploading?.slotId === slotId ? (
                  <div className="w-full h-full border-2 border-dashed border-white/25 rounded-2xl flex flex-col items-center justify-center gap-2 px-4">
                    {uploading.phase === 'processing' ? (
                      <span className="text-[11px] text-white/50 animate-pulse">Resizing…</span>
                    ) : (
                      <>
                        <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-[width]"
                            style={{ width: `${uploading.progress}%`, background: 'linear-gradient(90deg,#f43f5e,#ec4067)' }}
                          />
                        </div>
                        <span className="text-[11px] text-white/50">{uploading.progress}%</span>
                      </>
                    )}
                  </div>
                ) : (
                  <label className={`w-full h-full border-2 border-dashed border-white/25 rounded-2xl flex items-center justify-center ${uploading ? 'opacity-40' : 'cursor-pointer'}`}>
                    <span className="text-2xl text-white/40">＋</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={!!uploading}
                      className="sr-only"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) setEditing({ file: f, slotId }) }}
                    />
                  </label>
                )}
              </div>
            )
          })}
        </div>

        {/* Name */}
        <InfoCard>
          <FieldLabel>NAME <VerifiedSVG /></FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => save({ name })}
            className="w-full text-[20px] font-bold border-b border-white/20 focus:border-[#ec4067] outline-none pb-1 transition-colors"
          />
        </InfoCard>

        {/* Age + Location */}
        <InfoCard>
          <div className="flex gap-4">
            <div className="flex-1">
              <FieldLabel>AGE</FieldLabel>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                onBlur={() => { const n = Number(age); if (n >= 18 && n <= 99) save({ age: n }) }}
                className="w-full text-[20px] font-bold border-b border-white/20 focus:border-[#ec4067] outline-none pb-1 transition-colors"
              />
            </div>
            <div className="flex-1">
              <FieldLabel>LOCATION</FieldLabel>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onBlur={() => save({ location: location || null })}
                placeholder="City"
                className="w-full text-[20px] font-bold border-b border-white/20 focus:border-[#ec4067] outline-none pb-1 transition-colors"
              />
            </div>
          </div>
        </InfoCard>

        {/* Interests */}
        <InfoCard>
          <FieldLabel>INTERESTS</FieldLabel>
          <div className="flex flex-wrap gap-2 mt-2">
            {tags.map((tag) => (
              <span key={tag} className="glass border border-white/20 rounded-full px-4 py-2 text-sm flex items-center gap-1 text-white/90">
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="text-white/40 hover:text-white ml-1 leading-none"
                >
                  ✕
                </button>
              </span>
            ))}
            {tagPicker && ALL_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
              <button
                key={tag}
                onClick={() => addTag(tag)}
                className="border-2 border-dashed border-white/25 rounded-full px-4 py-2 text-sm text-white/50 transition-all hover:border-white/50"
              >
                {tag}
              </button>
            ))}
            <button
              onClick={() => {
                if (tagPicker) save({ interests: tags })
                setTagPicker((v) => !v)
              }}
              className="border-2 border-dashed border-white/30 rounded-full px-4 py-2 text-sm text-white/60"
            >
              {tagPicker ? '− Done' : '+ Add'}
            </button>
          </div>
        </InfoCard>

        {/* About me */}
        <InfoCard>
          <FieldLabel>ABOUT ME</FieldLabel>
          <textarea
            rows={4}
            maxLength={200}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            onBlur={() => save({ bio: bio.trim() || null })}
            placeholder="Tell people about yourself…"
            className="w-full resize-none outline-none text-[15px] text-white/90 mt-1"
          />
          <p className="text-right text-[11px] text-white/35 mt-1">{bio.length}/200</p>
        </InfoCard>

        {/* Icebreaker */}
        <div
          className="rounded-[24px] p-4 border border-[#ec4067]/40"
          style={{ background: 'rgba(236,64,103,.08)' }}
        >
          {/* Gradient strip */}
          <div
            className="h-1 rounded-full mb-4 -mx-4 -mt-4"
            style={{ background: 'linear-gradient(90deg,#f43f5e,#ec4067,#a855f7)' }}
          />
          <FieldLabel>ICEBREAKER</FieldLabel>
          <select
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onBlur={() => save({ icebreaker_prompt: prompt })}
            className="w-full text-[15px] font-semibold text-white mt-1 mb-3 outline-none cursor-pointer"
            style={{ background: 'transparent' }}
          >
            {PROMPTS.map((p) => (
              <option key={p} value={p} style={{ background: '#1a1024', color: 'white' }}>{p}</option>
            ))}
          </select>
          <textarea
            rows={3}
            maxLength={140}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onBlur={() => save({ icebreaker_answer: answer.trim() || null })}
            placeholder="Your answer…"
            className="w-full resize-none outline-none text-[14px] text-white/80 border-t border-white/15 pt-3"
          />
          <p className="text-right text-[11px] text-white/35 mt-1">{answer.length}/140</p>
        </div>

      </div>

      {settingsOpen && (
        <SettingsSheet
          isActive={profile.is_active}
          onPauseChange={handlePauseChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {editing && (
        <PhotoEditor
          file={editing.file}
          onCancel={() => setEditing(null)}
          onConfirm={async (edited) => {
            const { slotId } = editing
            setEditing(null)
            await handlePhotoUpload(edited, slotId)
          }}
        />
      )}
    </div>
  )
}
