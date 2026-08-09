import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuthStore } from '../store.js'
import type { UserProfile } from '../types.js'
import { SettingsSheet } from '../components/SettingsSheet.js'
import { PhotoEditor } from '../components/PhotoEditor.js'
import { PremiumCard } from '../components/premium/PremiumCard.js'
import { Card, IconButton, Icon, Sheet } from '../components/ui/index.js'
import type { IconName } from '../components/ui/index.js'
import { haptic } from '../telegram.js'

const ALL_TAGS = [
  '☕ Coffee', '✈️ Travel', '🎵 Music', '🎨 Art',
  '📚 Reading', '🥾 Hiking', '🍳 Cooking', '🎬 Film',
  '🐕 Dogs', '🏄 Surfing', '💃 Dancing', '🎸 Guitar',
  '🍷 Wine', '🧘 Yoga', '📷 Photography', '🎮 Gaming',
]

// Icebreaker prompts shown in the picker. `prompt` is stored verbatim on the
// profile (free-text column), `icon` is the glyph tile, and `hint` is the
// one-line coaching nudge the picker shows under each option.
interface Icebreaker {
  prompt: string
  icon: IconName
  hint: string
}

const ICEBREAKERS: Icebreaker[] = [
  { prompt: 'My ideal Sunday…', icon: 'sun', hint: 'Paint the scene — easy to picture, easy to reply.' },
  { prompt: 'Two truths and a lie…', icon: 'help-circle', hint: 'Make them guess — great reply rate.' },
  { prompt: 'The way to win me over is…', icon: 'heart', hint: 'Tell them exactly how — no guessing.' },
  { prompt: 'I geek out about…', icon: 'zap', hint: 'Passion is magnetic. Go niche.' },
  { prompt: 'A perfect first date…', icon: 'coffee', hint: 'Set the vibe for date one.' },
  { prompt: 'My most controversial opinion…', icon: 'flag', hint: 'Spark a friendly debate.' },
  // Newer additions
  { prompt: "We'll get along if…", icon: 'sparkles', hint: 'Filter for your kind of person.' },
  { prompt: 'My simple pleasures…', icon: 'star', hint: 'Small joys are surprisingly attractive.' },
  { prompt: "I'm weirdly good at…", icon: 'flame', hint: 'A little humble-brag goes a long way.' },
  { prompt: "A trip I'd take you on…", icon: 'map-pin', hint: 'Adventure bait — where are we going?' },
  { prompt: 'The last thing that made me laugh…', icon: 'message-dots', hint: 'Show off your sense of humor.' },
  { prompt: 'Green flags I look for…', icon: 'verified', hint: 'Say what you actually value.' },
]

// Resolve a stored prompt string to its metadata. Falls back gracefully for
// legacy/custom prompts that aren't in the current list.
function icebreakerFor(prompt: string | null | undefined): Icebreaker {
  const match = ICEBREAKERS.find((i) => i.prompt === prompt)
  if (match) return match
  return { prompt: prompt || ICEBREAKERS[0].prompt, icon: 'sparkle', hint: '' }
}

const SLOT_IDS = ['p', 'a', 'b', 'c', 'd', 'e'] as const

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <Card variant="filled" className="rounded-m3-lg">
      {children}
    </Card>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium text-txt2 tracking-wide mb-1.5 flex items-center gap-1.5">{children}</p>
  )
}

export function MyProfile({ onOpenSupport }: { onOpenSupport: () => void }) {
  const { user: storeUser, setUser } = useAuthStore()
  const [profile, setProfile] = useState<UserProfile | null>(storeUser)

  // Editable field states
  const [name, setName] = useState(storeUser?.name ?? '')
  const [age, setAge] = useState(String(storeUser?.age ?? ''))
  const [location, setLocation] = useState(storeUser?.location ?? '')
  const [bio, setBio] = useState(storeUser?.bio ?? '')
  const [tags, setTags] = useState<string[]>(storeUser?.interests ?? [])
  const [tagPicker, setTagPicker] = useState(false)
  const [prompt, setPrompt] = useState(storeUser?.icebreaker_prompt ?? ICEBREAKERS[0].prompt)
  const [answer, setAnswer] = useState(storeUser?.icebreaker_answer ?? '')
  const [promptPicker, setPromptPicker] = useState(false)
  const [uploading, setUploading] = useState<{ slotId: string; phase: 'processing' | 'uploading'; progress: number } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editing, setEditing] = useState<{ file: File; slotId: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    api.profile.get().then((p) => {
      setProfile(p)
      setUser(p)
      setName(p.name)
      setAge(String(p.age))
      setLocation(p.location ?? '')
      setBio(p.bio ?? '')
      setTags(p.interests)
      setPrompt(p.icebreaker_prompt ?? ICEBREAKERS[0].prompt)
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
    if (deletingId) return
    setDeletingId(photoId)
    try {
      await api.photos.delete(photoId)
      const p = await api.profile.get()
      setProfile(p)
      setUser(p)
    } finally {
      setDeletingId(null)
    }
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
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <h1 className="text-2xl font-medium text-txt">My Profile</h1>
        <IconButton
          icon="settings-2"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          tone="surface"
          iconSize={18}
        />
      </div>

      <div className="flex flex-col gap-3 px-4">

        {/* Photo grid */}
        <div className="photo-grid">
          {SLOT_IDS.map((slotId, i) => {
            const photo = photos[i]
            return (
              <div key={slotId} className={`slot-${slotId} relative rounded-m3-md overflow-hidden`}>
                {photo ? (
                  <>
                    <img
                      src={photo.url}
                      alt=""
                      onClick={() => setPrimaryPhoto(photo.id)}
                      className="w-full h-full object-cover cursor-pointer"
                    />
                    {slotId === 'p' && (
                      <span className="absolute bottom-2 left-2 text-white text-[10px] font-medium px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)' }}>
                        Primary
                      </span>
                    )}
                    <button
                      onClick={() => handlePhotoDelete(photo.id)}
                      disabled={deletingId === photo.id}
                      aria-label="Delete photo"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full text-white flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,.5)' }}
                    >
                      {deletingId === photo.id
                        ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Icon name="x" size={11} strokeWidth={2.5} />}
                    </button>
                    {deletingId === photo.id && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,.45)' }}>
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </>
                ) : uploading?.slotId === slotId ? (
                  <div className="w-full h-full bg-surface rounded-m3-md flex flex-col items-center justify-center gap-2 px-4">
                    {uploading.phase === 'processing' ? (
                      <span className="text-[11px] text-primary font-medium animate-pulse">Resizing…</span>
                    ) : (
                      <>
                        <div className="w-full h-1 rounded-full bg-surface-high overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-[width]"
                            style={{ width: `${uploading.progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-txt2">{uploading.progress}%</span>
                      </>
                    )}
                  </div>
                ) : (
                  <label className={`w-full h-full border-2 border-dashed border-outline rounded-m3-md bg-bg flex items-center justify-center text-primary ${uploading ? 'opacity-40' : 'cursor-pointer'}`}>
                    <Icon name="plus" size={22} />
                    <input
                      type="file"
                      accept="image/*"
                      disabled={!!uploading}
                      className="sr-only"
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setEditing({ file: f, slotId }) }}
                    />
                  </label>
                )}
              </div>
            )
          })}
        </div>

        <PremiumCard />

        {/* Name */}
        <InfoCard>
          <FieldLabel>Name <Icon name="verified" size={13} className="text-primary" /></FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => save({ name })}
            className="w-full text-[18px] font-medium bg-transparent text-txt border-b border-outline focus:border-primary outline-none pb-1.5 transition-colors"
          />
        </InfoCard>

        {/* Age + Location */}
        <InfoCard>
          <div className="flex gap-4">
            <div className="flex-1">
              <FieldLabel>Age</FieldLabel>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                onBlur={() => { const n = Number(age); if (n >= 18 && n <= 99) save({ age: n }) }}
                className="w-full text-[18px] font-medium bg-transparent text-txt border-b border-outline focus:border-primary outline-none pb-1.5 transition-colors"
              />
            </div>
            <div className="flex-1">
              <FieldLabel>Location</FieldLabel>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onBlur={() => save({ location: location || null })}
                placeholder="City"
                className="w-full text-[18px] font-medium bg-transparent text-txt placeholder:text-txt3 border-b border-outline focus:border-primary outline-none pb-1.5 transition-colors"
              />
            </div>
          </div>
        </InfoCard>

        {/* Interests */}
        <InfoCard>
          <FieldLabel>Interests</FieldLabel>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {tags.map((tag) => (
              <span key={tag} className="bg-primary-container text-on-primary-container rounded-m3-sm px-2.5 py-[7px] text-[13px] font-medium flex items-center gap-1.5">
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  aria-label="Remove"
                  className="text-on-primary-container opacity-60 hover:opacity-100 leading-none flex"
                >
                  <Icon name="x" size={11} strokeWidth={2.5} />
                </button>
              </span>
            ))}
            {tagPicker && ALL_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
              <button
                key={tag}
                onClick={() => addTag(tag)}
                className="border border-outline rounded-m3-sm px-2.5 py-[7px] text-[13px] text-txt2 transition-colors hover:bg-primary-container hover:text-on-primary-container hover:border-transparent"
              >
                {tag}
              </button>
            ))}
            <button
              onClick={() => {
                if (tagPicker) save({ interests: tags })
                setTagPicker((v) => !v)
              }}
              className="border border-dashed border-primary text-primary rounded-m3-sm px-2.5 py-[7px] text-[13px] font-medium"
            >
              {tagPicker ? '− Done' : '+ Add'}
            </button>
          </div>
        </InfoCard>

        {/* About me */}
        <InfoCard>
          <FieldLabel>About me</FieldLabel>
          <textarea
            rows={4}
            maxLength={200}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            onBlur={() => save({ bio: bio.trim() || null })}
            placeholder="Tell people about yourself…"
            className="w-full resize-none outline-none bg-transparent text-[14px] text-txt placeholder:text-txt3 mt-1.5 leading-relaxed"
          />
          <p className="text-right text-[11px] text-txt3 mt-1">{bio.length}/200</p>
        </InfoCard>

        {/* Icebreaker */}
        <div className="rounded-m3-lg p-4 bg-primary-container text-on-primary-container">
          <p className="text-[11px] font-bold uppercase tracking-wider text-on-primary-container">Icebreaker</p>
          {/* Tappable prompt row → opens the picker bottom sheet */}
          <button
            type="button"
            onClick={() => { haptic.selection(); setPromptPicker(true) }}
            className="w-full flex items-center gap-3 mt-2.5 mb-2.5 text-left"
          >
            <span className="w-10 h-10 rounded-m3-sm bg-[color-mix(in_srgb,var(--onpc)_12%,transparent)] flex items-center justify-center flex-none">
              <Icon name={icebreakerFor(prompt).icon} size={20} />
            </span>
            <span className="flex-1 min-w-0 text-[15px] font-medium text-on-primary-container truncate">{prompt}</span>
            <span className="flex items-center gap-0.5 text-[13px] font-medium opacity-80 flex-none">
              Change
              <Icon name="chevron-right" size={16} />
            </span>
          </button>
          <textarea
            rows={3}
            maxLength={140}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onBlur={() => save({ icebreaker_answer: answer.trim() || null })}
            placeholder="Your answer…"
            className="w-full resize-none outline-none bg-transparent text-[13px] text-on-primary-container placeholder:text-[color-mix(in_srgb,var(--onpc)_50%,transparent)] border-t border-[color-mix(in_srgb,var(--onpc)_20%,transparent)] pt-2.5 leading-relaxed"
          />
          <p className="text-right text-[11px] text-on-primary-container opacity-50 mt-1">{answer.length}/140</p>
        </div>

        {/* Support */}
        <button
          type="button"
          onClick={onOpenSupport}
          className="w-full text-left bg-surface rounded-m3-lg p-3.5 flex items-center gap-3.5 transition-colors hover:bg-surface-high"
        >
          <span className="w-11 h-11 rounded-full bg-primary-container text-primary flex items-center justify-center flex-none">
            <Icon name="life-buoy" size={20} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-medium text-[15px] text-txt">Support</span>
            <span className="block text-[12px] text-txt2">Questions, problems, feedback — we answer.</span>
          </span>
          <Icon name="chevron-right" size={18} className="text-txt2 flex-none" />
        </button>

      </div>

      <Sheet open={promptPicker} onClose={() => setPromptPicker(false)} title="Choose an icebreaker">
        <div className="flex flex-col gap-2 pb-2">
          {ICEBREAKERS.map((ib) => {
            const active = ib.prompt === prompt
            return (
              <button
                key={ib.prompt}
                type="button"
                onClick={() => {
                  haptic.selection()
                  setPrompt(ib.prompt)
                  save({ icebreaker_prompt: ib.prompt })
                  setPromptPicker(false)
                }}
                className={`w-full flex items-center gap-3 rounded-m3-lg p-3 text-left transition-colors ${active ? 'bg-primary-container' : 'bg-surface hover:bg-surface-high'}`}
              >
                <span
                  className={`w-11 h-11 rounded-m3-sm flex items-center justify-center flex-none ${active ? 'bg-primary text-white' : 'bg-primary-container text-primary'}`}
                >
                  <Icon name={ib.icon} size={20} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-[15px] font-medium ${active ? 'text-on-primary-container' : 'text-txt'}`}>{ib.prompt}</span>
                  <span className={`block text-[12px] leading-snug ${active ? 'text-on-primary-container opacity-70' : 'text-txt2'}`}>{ib.hint}</span>
                </span>
                {active && (
                  <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center flex-none">
                    <Icon name="check" size={15} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </Sheet>

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
