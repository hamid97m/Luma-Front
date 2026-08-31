import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { api } from '../api.js'
import { t } from '../i18n.js'
import { Icon } from '../components/ui'

// Shown when the account is paused for photo re-verification. Non-terminal:
// uploading any new profile photo lifts the pause server-side (see photos
// confirm), so we just reload afterwards to re-run auth and land in the app.
export function PhotoRequired() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(false)
    setBusy(true)
    try {
      await api.photos.upload(file)
      window.location.reload()
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center bg-bg text-txt">
      <div className="w-[72px] h-[72px] rounded-m3-lg bg-primary-container flex items-center justify-center">
        <Icon name="camera" size={32} className="text-primary" />
      </div>
      <h1 className="text-[24px] font-medium">{t.photoRequired.title}</h1>
      <p className="text-[14px] text-txt2 leading-relaxed">{t.photoRequired.body}</p>
      {error && <p className="text-[13px] text-error">{t.photoRequired.error}</p>}
      <label
        className={[
          'mt-2 inline-flex items-center gap-2 rounded-full bg-primary text-white',
          'h-11 px-6 text-[14px] font-medium shadow-m3-1',
          busy ? 'opacity-60 pointer-events-none' : 'cursor-pointer',
        ].join(' ')}
      >
        <Icon name="camera" size={18} />
        {busy ? t.photoRequired.uploading : t.photoRequired.upload}
        <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={onPick} />
      </label>
    </div>
  )
}
