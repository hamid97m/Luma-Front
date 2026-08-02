import { useState } from 'react'
import { api } from '../api.js'
import { clearReturningUser } from '../utils/returningUser.js'

interface Props {
  isActive: boolean
  onPauseChange: (isActive: boolean) => void
  onClose: () => void
}

export function SettingsSheet({ isActive, onPauseChange, onClose }: Props) {
  const [view, setView] = useState<'menu' | 'confirmDelete'>('menu')
  const [pausing, setPausing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const togglePause = async () => {
    setPausing(true)
    try {
      await api.profile.update({ is_active: !isActive })
      onPauseChange(!isActive)
    } finally {
      setPausing(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.profile.delete()
      clearReturningUser()
      window.location.reload()
    } catch {
      setDeleting(false)
      window.Telegram?.WebApp?.showAlert?.('Something went wrong. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4">
      <div className="glass border border-white/15 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        {view === 'menu' ? (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-extrabold text-white">Settings</h2>
              <button onClick={onClose} aria-label="Close" className="text-white/50 text-2xl leading-none">✕</button>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              aria-label="Pause my account"
              disabled={pausing}
              onClick={togglePause}
              className="w-full text-left glass border border-white/12 rounded-2xl p-4 mb-4 disabled:opacity-60"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-semibold">Pause my account</span>
                {pausing ? (
                  <div
                    aria-hidden="true"
                    className="w-5 h-5 border-2 border-white/40 border-t-transparent rounded-full animate-spin"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className={`w-12 h-7 rounded-full transition-colors relative inline-block flex-shrink-0 ${isActive ? 'bg-[#ec4067]' : 'bg-white/20'}`}
                  >
                    <span
                      className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform"
                      style={{ transform: isActive ? 'translateX(22px)' : 'translateX(2px)' }}
                    />
                  </span>
                )}
              </div>
              <p className="text-white/50 text-[13px] font-normal">
                You won't appear in Discovery. Your existing matches can still reach you.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setView('confirmDelete')}
              className="w-full text-left rounded-2xl p-4 border border-rose-500/40"
              style={{ background: 'rgba(244,63,94,.08)' }}
            >
              <p className="text-rose-300 font-bold text-[13px] uppercase tracking-widest mb-2">Danger zone</p>
              <span className="text-rose-400 font-semibold">Delete my account</span>
            </button>
          </>
        ) : (
          <>
            <h2 className="text-xl font-extrabold text-white mb-3">Delete your account?</h2>
            <p className="text-white/60 text-[14px] mb-6">
              This is permanent. You'll be removed from Discovery, your existing matches will lose the connection, and all your photos and profile info will be erased.
            </p>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full py-3 rounded-2xl bg-rose-500 text-white font-bold mb-3"
            >
              {deleting ? 'Deleting…' : 'Yes, delete my account'}
            </button>
            <button onClick={() => setView('menu')} disabled={deleting} className="w-full py-3 text-white/50 font-semibold">
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}
