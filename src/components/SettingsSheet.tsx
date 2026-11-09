import { useState } from 'react'
import { api, type DeleteReason } from '../api.js'
import { clearReturningUser } from '../utils/returningUser.js'
import { closeMiniApp, haptic, isDarkTheme, setThemePref } from '../telegram.js'
import { t, useLocaleStore } from '../i18n.js'
import { LOCALE_META, clearStoredLocale, setLocalePending, type Locale } from '../i18n/locale.js'
import { LanguageOptions } from './LanguageOptions.js'
import { endSession, isInsideTelegram } from '../session.js'
import { Button, Icon, Sheet } from './ui'

// Exit-survey options, in display order (codes match the backend contract).
const DELETE_REASONS: DeleteReason[] = [
  'found_someone',
  'few_matches',
  'no_replies',
  'fake_profiles',
  'too_expensive',
  'privacy_safety',
  'buggy',
  'taking_break',
  'other',
]
const NOTE_MAX = 500

interface Props {
  isActive: boolean
  onPauseChange: (isActive: boolean) => void
  onClose: () => void
}

export function SettingsSheet({ isActive, onPauseChange, onClose }: Props) {
  const [view, setView] = useState<'menu' | 'reason' | 'confirmDelete'>('menu')
  // null = no answer (nothing picked yet, or the survey was skipped).
  const [reason, setReason] = useState<DeleteReason | null>(null)
  const [note, setNote] = useState('')
  const [pausing, setPausing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [dark, setDark] = useState(isDarkTheme())
  const [langOpen, setLangOpen] = useState(false)
  const locale = useLocaleStore((s) => s.locale)

  const changeLocale = (next: Locale) => {
    if (next === locale) return
    // Mark pending BEFORE switching: the store change remounts the app, which
    // re-runs /auth/verify and may answer with the OLD server locale before the
    // PATCH below lands. With the flag set, App's server sync re-sends the local
    // choice instead of reverting it.
    setLocalePending(true)
    useLocaleStore.getState().setLocale(next) // persists + remounts the app via main.tsx
    api.profile
      .setLocale(next)
      .then(() => setLocalePending(false))
      .catch(() => {
        /* flag stays set; re-sent on next launch */
      })
  }

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
      const trimmed = note.trim()
      await api.profile.delete(
        reason ? { reason, ...(trimmed ? { note: trimmed.slice(0, NOTE_MAX) } : {}) } : undefined,
      )
      clearReturningUser()
      // The server also nulls `locale`; forget the device copy too so the
      // re-signup starts with the first-open language picker.
      clearStoredLocale()
      // Leave instead of reloading: a reload signs straight back in, and the
      // backend treats a sign-in on a deleted account as a return (clears
      // deleted_at), so the account would never stay deleted.
      if (isInsideTelegram()) closeMiniApp()
      else endSession({ kind: 'signedOut' })
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
            aria-expanded={langOpen}
            aria-controls="settings-language-options"
            onClick={() => {
              haptic.selection()
              setLangOpen((o) => !o)
            }}
            className="w-full text-start bg-surface rounded-m3-lg p-4 mb-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-txt font-medium text-[15px] flex items-center gap-2.5">
                <Icon name="globe" size={17} className="text-txt2" />
                {t.language.settingsLabel}
              </span>
              <span className="flex items-center gap-1.5 text-txt2 text-[14px]">
                <span lang={locale} dir={LOCALE_META[locale].dir}>{LOCALE_META[locale].nativeName}</span>
                <Icon
                  name="chevron-down"
                  size={16}
                  className={`flex-none transition-transform ${langOpen ? 'rotate-180' : ''}`}
                />
              </span>
            </div>
          </button>
          {langOpen && (
            <div id="settings-language-options" className="mb-2.5">
              <LanguageOptions value={locale} onChange={changeLocale} />
            </div>
          )}

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

          {/* Website only — inside Telegram the account is the Telegram one. */}
          {!isInsideTelegram() && (
            <button
              type="button"
              onClick={() => {
                haptic.selection()
                // App drops the token and shows the Login screen.
                endSession({ kind: 'signedOut' })
              }}
              className="w-full text-start bg-surface rounded-m3-lg p-4 mb-2.5"
            >
              <span className="text-txt font-medium text-[15px] flex items-center gap-2.5">
                <Icon
                  name="log-out"
                  size={17}
                  className={`text-txt2 ${LOCALE_META[locale].dir === 'rtl' ? '-scale-x-100' : ''}`}
                />
                {t.settings.logout}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setView('reason')}
            className="w-full text-start rounded-m3-lg p-4 bg-error-container"
          >
            <p className="text-error font-bold text-[11px] uppercase tracking-widest mb-1">{t.settings.dangerZone}</p>
            <span className="text-error font-medium text-[15px] flex items-center gap-2.5">
              <Icon name="trash" size={17} />
              {t.settings.deleteAccount}
            </span>
          </button>
        </>
      ) : view === 'reason' ? (
        <>
          <h2 className="text-[22px] font-medium text-txt mb-1">{t.settings.reasonTitle}</h2>
          <p className="text-txt2 text-[14px] mb-4 leading-relaxed">{t.settings.reasonSubtitle}</p>

          <div role="radiogroup" aria-label={t.settings.reasonTitle} className="flex flex-col gap-2 mb-4">
            {DELETE_REASONS.map((r) => {
              const selected = r === reason
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    haptic.selection()
                    setReason(r)
                  }}
                  className={`w-full text-start rounded-m3-lg px-4 py-3.5 flex items-center justify-between gap-3 transition-colors ${
                    selected ? 'bg-primary-container text-on-primary-container' : 'bg-surface text-txt hover:bg-surface-high'
                  }`}
                >
                  <span className="text-[15px] font-medium">{t.settings.reasons[r]}</span>
                  {selected && <Icon name="check" size={18} className="flex-none" />}
                </button>
              )
            })}
          </div>

          {/* Free-text detail, offered once a reason is picked. */}
          {reason && (
            <label className="block bg-surface rounded-m3-lg p-4 mb-4">
              <span className="text-txt2 text-[13px]">{t.settings.reasonNoteLabel}</span>
              <textarea
                rows={3}
                maxLength={NOTE_MAX}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.settings.reasonNotePlaceholder}
                className="w-full resize-none outline-none bg-transparent text-[14px] text-txt placeholder:text-txt3 mt-1.5 leading-relaxed"
              />
              <p className="text-end text-[11px] text-txt3 mt-1">{note.length}/{NOTE_MAX}</p>
            </label>
          )}

          <Button
            onClick={() => setView('confirmDelete')}
            disabled={!reason}
            block
            size="lg"
            className="mb-2"
          >
            {t.settings.reasonContinue}
          </Button>
          <Button
            onClick={() => {
              setReason(null)
              setNote('')
              setView('confirmDelete')
            }}
            variant="text"
            block
            className="mb-1"
          >
            {t.settings.reasonSkip}
          </Button>
          <Button onClick={() => setView('menu')} variant="text" block>
            {t.settings.cancel}
          </Button>
        </>
      ) : (
        <>
          {reason === 'found_someone' && (
            <p className="text-primary text-[14px] font-medium mb-2">{t.settings.congrats}</p>
          )}
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
          <Button onClick={() => setView('reason')} disabled={deleting} variant="text" block>
            {t.settings.cancel}
          </Button>
        </>
      )}
    </Sheet>
  )
}
