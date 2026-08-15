import { useState } from 'react'
import { api } from '../api.js'
import { mainButtonSupported, useMainButton } from '../telegram.js'
import { PhotoEditor } from '../components/PhotoEditor.js'
import { t } from '../i18n.js'
import { Button, IconButton, Input, Textarea, Chip, Icon } from '../components/ui/index.js'

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
        const msg = err instanceof Error ? err.message : t.errors.unknown
        window.Telegram?.WebApp?.showAlert?.(t.onboarding.error(msg))
      } finally {
        setSaving(false)
      }
    }
  }

  // Native Telegram button drives the primary step action. Falls back to the
  // in-page button below when Telegram provides no MainButton.
  useMainButton({
    text: step === TOTAL_STEPS - 1 ? t.onboarding.enter : t.onboarding.continue,
    visible: true,
    enabled: valid && !saving,
    loading: saving,
    onClick: next,
  })

  const toggleInterest = (tag: string) => {
    setState((s) => {
      if (s.interests.includes(tag)) {
        return { ...s, interests: s.interests.filter((x) => x !== tag) }
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
      const msg = err instanceof Error ? err.message : t.photoGrid.uploadFailed
      window.Telegram?.WebApp?.showAlert?.(msg)
    } finally {
      setUploadPhase(null)
    }
  }

  return (
    <div
      className="flex flex-col h-full relative overflow-hidden bg-bg text-txt"
      style={{ paddingTop: 'var(--tg-safe-top)' }}
    >
      {/* Top bar */}
      <div className="relative z-10 flex items-center gap-2 px-4 pt-12 pb-4">
        <IconButton
          icon="arrow-left"
          onClick={back}
          aria-label={t.aria.back}
          tone="ghost"
          iconSize={22}
          className={`text-txt transition-opacity ${step === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        />
        <div className="flex-1 flex gap-1 pr-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i <= step ? 'bg-primary' : 'bg-surface-high'}`}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 py-2">
        <div key={step} className="animate-fade-up flex flex-col gap-5">

          {/* Step 0: Name */}
          {step === 0 && (
            <>
              <h2 className="text-[28px] font-medium leading-tight text-txt">{t.onboarding.nameQ}</h2>
              <Input
                autoFocus
                type="text"
                value={state.name}
                onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
                placeholder={t.onboarding.namePlaceholder}
                className="text-[18px] font-normal"
              />
            </>
          )}

          {/* Step 1: Age */}
          {step === 1 && (
            <>
              <h2 className="text-[28px] font-medium leading-tight text-txt">{t.onboarding.ageQ}</h2>
              <Input
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
                className="text-[44px] font-medium text-center rounded-m3-lg"
              />
              {ageError && (
                <p className="text-error text-sm text-center">{t.onboarding.ageMin}</p>
              )}
            </>
          )}

          {/* Step 2: Gender */}
          {step === 2 && (
            <>
              <h2 className="text-[28px] font-medium leading-tight text-txt">{t.onboarding.iAm}</h2>
              <div className="flex flex-col gap-2.5">
                {([['woman', t.onboarding.genders[0]], ['man', t.onboarding.genders[1]], ['nonbinary', t.onboarding.genders[2]]] as const).map(([val, label]) => {
                  const selected = state.gender === val
                  return (
                    <button
                      key={val}
                      onClick={() => setState((s) => ({ ...s, gender: val }))}
                      className={`rounded-m3-md px-[17px] py-[15px] text-[15px] text-left flex items-center justify-between cursor-pointer transition-colors border-2 ${
                        selected
                          ? 'bg-primary-container text-on-primary-container border-primary font-medium'
                          : 'bg-surface text-txt border-transparent'
                      }`}
                    >
                      <span>{label}</span>
                      {selected && <Icon name="check" size={20} className="text-primary" strokeWidth={2.5} />}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Step 3: Preference */}
          {step === 3 && (
            <>
              <h2 className="text-[28px] font-medium leading-tight text-txt">{t.onboarding.interestedIn}</h2>
              <div className="flex flex-col gap-2.5">
                {([['men', t.onboarding.prefOptions[0]], ['women', t.onboarding.prefOptions[1]], ['everyone', t.onboarding.prefOptions[2]]] as const).map(([val, label]) => {
                  const selected = state.pref === val
                  return (
                    <button
                      key={val}
                      onClick={() => setState((s) => ({ ...s, pref: val }))}
                      className={`rounded-m3-md px-[17px] py-[15px] text-[15px] text-left flex items-center justify-between cursor-pointer transition-colors border-2 ${
                        selected
                          ? 'bg-primary-container text-on-primary-container border-primary font-medium'
                          : 'bg-surface text-txt border-transparent'
                      }`}
                    >
                      <span>{label}</span>
                      {selected && <Icon name="check" size={20} className="text-primary" strokeWidth={2.5} />}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Step 4: Interests */}
          {step === 4 && (
            <>
              <div>
                <h2 className="text-[28px] font-medium leading-tight text-txt">{t.onboarding.pickInterests}</h2>
                <p className="text-[13px] text-txt2 mt-1.5">
                  {t.onboarding.tagCount(state.interests.length)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {t.interests.map((tag) => (
                  <Chip
                    key={tag}
                    selected={state.interests.includes(tag)}
                    onClick={() => toggleInterest(tag)}
                  >
                    {tag}
                  </Chip>
                ))}
              </div>
            </>
          )}

          {/* Step 5: Photo + Bio */}
          {step === 5 && (
            <>
              <h2 className="text-[28px] font-medium leading-tight text-txt">{t.onboarding.photoBio}</h2>
              <div className="flex gap-4">
                <label className="relative cursor-pointer flex-shrink-0">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setEditingFile(f) }}
                  />
                  <div className={`relative w-32 h-32 rounded-m3-lg flex flex-col items-center justify-center overflow-hidden box-border ${
                    photoPreview ? '' : 'border-2 border-dashed border-outline bg-bg'
                  }`}>
                    {photoPreview
                      ? <img src={photoPreview} alt="" className="w-full h-full object-cover rounded-m3-lg" />
                      : <Icon name="camera" size={28} className="text-primary" />
                    }
                    {uploadPhase && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3" style={{ background: 'var(--scrim)' }}>
                        {uploadPhase.phase === 'processing' ? (
                          <span className="text-[11px] text-white font-medium animate-pulse">{t.onboarding.resizing}</span>
                        ) : (
                          <>
                            <div className="w-full h-1 rounded-full bg-white/25 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-white transition-[width]"
                                style={{ width: `${uploadPhase.progress}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-white">{uploadPhase.progress}%</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {photoUploaded && (
                    <span className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-medium px-2.5 py-0.5 rounded-full">
                      {t.onboarding.added}
                    </span>
                  )}
                </label>

                <div className="flex-1 flex flex-col gap-1">
                  <Textarea
                    rows={5}
                    maxLength={150}
                    value={state.bio}
                    onChange={(e) => setState((s) => ({ ...s, bio: e.target.value }))}
                    placeholder={t.onboarding.bioPlaceholder}
                  />
                  <p className="text-right text-[11px] text-txt3">{state.bio.length}/150</p>
                </div>
              </div>
              <div className="flex gap-2.5 bg-surface rounded-m3-md px-3.5 py-3">
                <Icon name="alert-triangle" size={16} className="text-primary flex-none mt-px" />
                <p className="text-txt2 text-[12px] leading-relaxed">
                  {t.onboarding.realPhotos}
                </p>
              </div>
              <p className="text-txt3 text-[12px] text-center">
                {t.onboarding.pauseNote}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Sticky bottom button — fallback when Telegram provides no MainButton */}
      {!mainButtonSupported() && (
        <div className="relative z-10 px-6 pb-10 pt-4">
          <Button block size="lg" onClick={next} disabled={!valid || saving}>
            {saving ? '…' : step === TOTAL_STEPS - 1 ? t.onboarding.enter : t.onboarding.continue}
          </Button>
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
