import { useState } from 'react'
import { api } from '../api.js'
import { mainButtonSupported, useMainButton } from '../telegram.js'
import { PhotoEditor } from '../components/PhotoEditor.js'

const ALL_TAGS = [
  '☕ Coffee', '✈️ Travel', '🎵 Music', '🎨 Art',
  '📚 Reading', '🥾 Hiking', '🍳 Cooking', '🎬 Film',
  '🐕 Dogs', '🏄 Surfing', '💃 Dancing', '🎸 Guitar',
  '🍷 Wine', '🧘 Yoga', '📷 Photography', '🎮 Gaming',
]

interface State {
  name: string
  age: string
  gender: 'woman' | 'man' | 'nonbinary' | ''
  pref: 'men' | 'women' | 'everyone' | ''
  interests: string[]
  bio: string
}

interface Props {
  onComplete: () => Promise<void>
}

const TOTAL_STEPS = 6

function isValid(step: number, state: State, photoUploaded: boolean): boolean {
  if (step === 0) return state.name.trim().length >= 2
  if (step === 1) { const n = Number(state.age); return n >= 18 && n <= 99 }
  if (step === 2) return state.gender !== ''
  if (step === 3) return state.pref !== ''
  if (step === 4) return state.interests.length >= 3
  if (step === 5) return photoUploaded
  return false
}

export function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [state, setState] = useState<State>({
    name: '', age: '', gender: '', pref: '', interests: [], bio: '',
  })
  const [photoUploaded, setPhotoUploaded] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadPhase, setUploadPhase] = useState<{ phase: 'processing' | 'uploading'; progress: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [ageError, setAgeError] = useState(false)
  const [editingFile, setEditingFile] = useState<File | null>(null)

  const valid = isValid(step, state, photoUploaded)

  const back = () => setStep((s) => Math.max(0, s - 1))

  const next = async () => {
    if (!valid) return
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1)
    } else {
      setSaving(true)
      try {
        await api.profile.update({
          name: state.name.trim(),
          age: Number(state.age),
          gender: state.gender as 'man' | 'woman' | 'nonbinary',
          looking_for: state.pref as 'men' | 'women' | 'everyone',
          bio: state.bio.trim() || null,
          interests: state.interests,
        })
        await onComplete()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        window.Telegram?.WebApp?.showAlert?.(`Error: ${msg}`)
      } finally {
        setSaving(false)
      }
    }
  }

  // Native Telegram button drives the primary step action. Falls back to the
  // in-page button below when Telegram provides no MainButton.
  useMainButton({
    text: step === TOTAL_STEPS - 1 ? 'Enter Luma' : 'Continue',
    visible: true,
    enabled: valid && !saving,
    loading: saving,
    onClick: next,
  })

  const toggleInterest = (tag: string) => {
    setState((s) => {
      if (s.interests.includes(tag)) {
        return { ...s, interests: s.interests.filter((t) => t !== tag) }
      }
      if (s.interests.length >= 5) return s
      return { ...s, interests: [...s.interests, tag] }
    })
  }

  const handlePhotoFile = async (file: File) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    const preview = URL.createObjectURL(file)
    setPhotoPreview(preview)
    setUploadPhase({ phase: 'processing', progress: 0 })
    try {
      await api.photos.upload(file, (progress) => setUploadPhase({ phase: 'uploading', progress }))
      setPhotoUploaded(true)
    } catch (err) {
      setPhotoPreview(null)
      const msg = err instanceof Error ? err.message : 'Upload failed'
      window.Telegram?.WebApp?.showAlert?.(msg)
    } finally {
      setUploadPhase(null)
    }
  }

  const cardUnselected = 'glass border border-white/15 rounded-2xl py-4 px-6 text-white/80 text-left flex items-center justify-between cursor-pointer transition-all'
  const cardSelected = 'bg-white/95 text-[#1a1024] scale-[1.02] shadow-2xl rounded-2xl py-4 px-6 font-bold flex items-center justify-between cursor-pointer transition-all'

  return (
    <div
      className="flex flex-col h-screen relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg,#1a1024 0%,#2a0f22 55%,#10101a 100%)',
        paddingTop: 'var(--tg-safe-top)',
      }}
    >
      {/* Background glow blobs */}
      <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full blur-3xl opacity-30 pointer-events-none"
           style={{ background: '#ec4067' }} />
      <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-30 pointer-events-none"
           style={{ background: '#a855f7' }} />

      {/* Top bar */}
      <div className="relative z-10 flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          onClick={back}
          className={`text-white/70 text-2xl w-8 flex-shrink-0 transition-opacity ${step === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          ‹
        </button>
        <div className="flex-1 flex gap-1">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all duration-500"
              style={i <= step
                ? { background: 'linear-gradient(90deg,#ec4067,#a855f7)' }
                : { background: 'rgba(255,255,255,.15)' }
              }
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-2">
        <div key={step} className="animate-fade-up flex flex-col gap-5">

          {/* Step 0: Name */}
          {step === 0 && (
            <>
              <h2 className="text-[28px] font-extrabold text-white">What's your name?</h2>
              <input
                autoFocus
                type="text"
                value={state.name}
                onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
                placeholder="Your name"
                className="w-full text-[20px] font-semibold border-b-2 border-white/20 focus:border-[#ec4067] outline-none pb-2 transition-colors"
              />
            </>
          )}

          {/* Step 1: Age */}
          {step === 1 && (
            <>
              <h2 className="text-[28px] font-extrabold text-white">How old are you?</h2>
              <input
                autoFocus
                type="number"
                min={18}
                max={99}
                value={state.age}
                onChange={(e) => {
                  setState((s) => ({ ...s, age: e.target.value }))
                  setAgeError(e.target.value.length >= 2 && Number(e.target.value) < 18)
                }}
                placeholder="25"
                className="w-full text-[48px] font-extrabold text-center border-b-2 border-white/20 focus:border-[#ec4067] outline-none pb-2 transition-colors"
              />
              {ageError && (
                <p className="text-rose-400 text-sm text-center">You must be at least 18.</p>
              )}
            </>
          )}

          {/* Step 2: Gender */}
          {step === 2 && (
            <>
              <h2 className="text-[28px] font-extrabold text-white">I am a…</h2>
              <div className="flex flex-col gap-3">
                {([['woman', 'Woman 👩'], ['man', 'Man 👨'], ['nonbinary', 'Non-binary 🧑']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setState((s) => ({ ...s, gender: val }))}
                    className={state.gender === val ? cardSelected : cardUnselected}
                  >
                    <span>{label}</span>
                    {state.gender === val && <span className="text-[#ec4067] font-bold">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 3: Preference */}
          {step === 3 && (
            <>
              <h2 className="text-[28px] font-extrabold text-white">Interested in…</h2>
              <div className="flex flex-col gap-3">
                {([['men', 'Men 👨'], ['women', 'Women 👩'], ['everyone', 'Everyone 🌈']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setState((s) => ({ ...s, pref: val }))}
                    className={state.pref === val ? cardSelected : cardUnselected}
                  >
                    <span>{label}</span>
                    {state.pref === val && <span className="text-[#ec4067] font-bold">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 4: Interests */}
          {step === 4 && (
            <>
              <div>
                <h2 className="text-[28px] font-extrabold text-white">Pick your interests</h2>
                <p className="text-[14px] text-white/50 mt-1">
                  {state.interests.length}/5 selected · choose at least 3
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {ALL_TAGS.map((tag) => {
                  const selected = state.interests.includes(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleInterest(tag)}
                      className={`rounded-full px-4 py-2 text-sm transition-all ${
                        selected
                          ? 'bg-white/90 text-[#1a1024] font-semibold'
                          : 'glass border border-white/20 text-white/80'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Step 5: Photo + Bio */}
          {step === 5 && (
            <>
              <h2 className="text-[28px] font-extrabold text-white">Add a photo & bio</h2>
              <div className="flex gap-4">
                <label className="relative cursor-pointer flex-shrink-0">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setEditingFile(f) }}
                  />
                  <div className={`relative w-32 h-32 rounded-2xl flex flex-col items-center justify-center overflow-hidden ${
                    photoPreview ? '' : 'border-2 border-dashed border-white/30'
                  }`}>
                    {photoPreview
                      ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover rounded-2xl" />
                      : <span className="text-3xl text-white/40">＋</span>
                    }
                    {uploadPhase && (
                      <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-1.5 px-3">
                        {uploadPhase.phase === 'processing' ? (
                          <span className="text-[11px] text-white/80 animate-pulse">Resizing…</span>
                        ) : (
                          <>
                            <div className="w-full h-1.5 rounded-full bg-white/20 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-[width]"
                                style={{ width: `${uploadPhase.progress}%`, background: 'linear-gradient(90deg,#f43f5e,#ec4067)' }}
                              />
                            </div>
                            <span className="text-[10px] text-white/70">{uploadPhase.progress}%</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {photoUploaded && (
                    <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Nice! ✓
                    </span>
                  )}
                </label>

                <div className="flex-1 flex flex-col gap-1">
                  <textarea
                    rows={5}
                    maxLength={150}
                    value={state.bio}
                    onChange={(e) => setState((s) => ({ ...s, bio: e.target.value }))}
                    placeholder="Write a short bio…"
                    className="w-full glass border border-white/15 rounded-2xl p-3 text-sm resize-none outline-none focus:border-[#ec4067] transition-colors"
                  />
                  <p className="text-right text-[11px] text-white/35">{state.bio.length}/150</p>
                </div>
              </div>
              <p className="glass border border-amber-400/30 rounded-2xl px-4 py-3 text-amber-200/90 text-[12px] leading-relaxed">
                ⚠️ Use real photos of yourself. Fake photos can be reported by
                other users and will get your account blocked.
              </p>
              <p className="text-white/40 text-[12px] text-center">
                You can pause or delete your account anytime from Settings.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Sticky bottom button — fallback when Telegram provides no MainButton */}
      {!mainButtonSupported() && (
        <div className="relative z-10 px-5 pb-8 pt-4">
          <button onClick={next} disabled={!valid || saving} className="btn-primary">
            {saving ? '…' : step === TOTAL_STEPS - 1 ? 'Enter Luma' : 'Continue'}
          </button>
        </div>
      )}

      {editingFile && (
        <PhotoEditor
          file={editingFile}
          onCancel={() => setEditingFile(null)}
          onConfirm={async (edited) => {
            setEditingFile(null)
            await handlePhotoFile(edited)
          }}
        />
      )}
    </div>
  )
}
