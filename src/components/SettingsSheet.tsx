import { useState } from 'react'
import { api } from '../api.js'
import { clearReturningUser } from '../utils/returningUser.js'
import { haptic, isDarkTheme, setThemePref } from '../telegram.js'
import { t } from '../i18n.js'
import { Button, Icon, Sheet } from './ui'

interface Props {
  isActive: boolean
  onPauseChange: (isActive: boolean) => void
  onClose: () => void
}

export function SettingsSheet({ isActive, onPauseChange, onClose }: Props) {
  const [view, setView] = useState<'menu' | 'confirmDelete'>('menu')
  const [pausing, setPausing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [dark, setDark] = useState(isDarkTheme())

  const toggleDark = () => {
    const next = !dark
    setThemePref(next ? 'dark' : 'light')
    setDark(next)
    haptic.selection()
  }

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
      window.Telegram?.WebApp?.showAlert?.(t.settings.error)
    }
  }

  return (
    <Sheet open onClose={onClose}>
      {view === 'menu' ? (
        <>
          <h2 className="text-[22px] font-medium text-txt mb-4">{t.settings.title}</h2>

          <button
            type="button"
            role="switch"
            aria-checked={dark}
            aria-label={t.settings.darkTheme}
            onClick={toggleDark}
            className="w-full text-start bg-surface rounded-m3-lg p-4 mb-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-txt font-medium text-[15px] flex items-center gap-2.5">
                <Icon name="moon" size={17} className="text-txt2" />
                {t.settings.darkTheme}
              </span>
              <span
                aria-hidden="true"
                className={`w-12 h-7 rounded-full transition-colors relative inline-block flex-shrink-0 ${dark ? 'bg-primary' : 'bg-[var(--ol2)]'}`}
              >
                <span
                  className="absolute top-0.5 left-0 w-6 h-6 rounded-full bg-white transition-transform"
                  style={{ transform: dark ? 'translateX(22px)' : 'translateX(2px)' }}
                />
              </span>
            </div>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={!isActive}
            aria-label={t.settings.pause}
            disabled={pausing}
            onClick={togglePause}
            className="w-full text-start bg-surface rounded-m3-lg p-4 mb-2.5 disabled:opacity-60"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-txt font-medium text-[15px] flex items-center gap-2.5">
                <Icon name="eye" size={17} className="text-txt2" />
                {t.settings.pause}
              </span>
              {pausing ? (
                <div
                  aria-hidden="true"
                  className="w-5 h-5 border-2 border-outline-variant border-t-transparent rounded-full"
                  style={{ animation: 'lumaSpin .8s linear infinite' }}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className={`w-12 h-7 rounded-full transition-colors relative inline-block flex-shrink-0 ${!isActive ? 'bg-primary' : 'bg-[var(--ol2)]'}`}
                >
                  <span
                    className="absolute top-0.5 left-0 w-6 h-6 rounded-full bg-white transition-transform"
                    style={{ transform: !isActive ? 'translateX(22px)' : 'translateX(2px)' }}
                  />
                </span>
              )}
            </div>
            <p className="text-txt2 text-[13px] font-normal leading-relaxed">
              {t.settings.pauseHint}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setView('confirmDelete')}
            className="w-full text-start rounded-m3-lg p-4 bg-error-container"
          >
            <p className="text-error font-bold text-[11px] uppercase tracking-widest mb-1">{t.settings.dangerZone}</p>
            <span className="text-error font-medium text-[15px] flex items-center gap-2.5">
              <Icon name="trash" size={17} />
              {t.settings.deleteAccount}
            </span>
          </button>
        </>
      ) : (
        <>
          <h2 className="text-[22px] font-medium text-txt mb-2.5">{t.settings.confirmTitle}</h2>
          <p className="text-txt2 text-[14px] mb-5 leading-relaxed">
            {t.settings.confirmBody}
          </p>
          <Button
            onClick={handleDelete}
            disabled={deleting}
            variant="destructive"
            block
            size="lg"
            className="mb-2"
          >
            {deleting ? t.settings.deleting : t.settings.confirmDelete}
          </Button>
          <Button onClick={() => setView('menu')} disabled={deleting} variant="text" block>
            {t.settings.cancel}
          </Button>
        </>
      )}
    </Sheet>
  )
}
