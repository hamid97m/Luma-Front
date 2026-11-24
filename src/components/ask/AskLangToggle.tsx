// One-tap language switch on the friend-side ask screens: the flag is the language
// you'd switch TO (Iran flag while the screen is in English/Arabic, UK flag in Persian).
// A friend arriving from a share link hasn't picked a language yet, and Telegram
// set to English defaults her to English.
import { api } from '../../api.js'
import { LOCALE_META, useLocaleStore, type Locale } from '../../i18n.js'
import { markLocaleChosen, setLocalePending } from '../../i18n/locale.js'
import { haptic } from '../../telegram.js'

interface Props {
  /** Signed-in member → save the choice now. Link visitors may have no account:
   *  theirs is sent on the next app launch (pending flag). */
  saveNow?: boolean
  /** Runs just before the switch — it remounts the whole app (main.tsx). */
  onBeforeSwitch?: () => void
  className?: string
}

export function AskLangToggle({ saveNow = false, onBeforeSwitch, className = '' }: Props) {
  const locale = useLocaleStore((s) => s.locale)
  const next: Locale = locale === 'fa' ? 'en' : 'fa'

  const toggle = () => {
    haptic.selection()
    onBeforeSwitch?.()
    // Same order as Settings: flag first, so the remount's server sync re-sends
    // this choice instead of reverting it. Marked chosen so a later sign-up
    // doesn't override it with Telegram's language.
    setLocalePending(true)
    markLocaleChosen()
    useLocaleStore.getState().setLocale(next)
    if (saveNow) {
      api.profile.setLocale(next).then(() => setLocalePending(false)).catch(() => { /* re-sent next launch */ })
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      lang={next}
      aria-label={LOCALE_META[next].nativeName}
      data-testid="ask-lang-toggle"
      className={`w-11 h-11 rounded-full bg-surface flex items-center justify-center text-[22px] leading-none flex-none hover:bg-surface-high transition-colors ${className}`}
    >
      <span aria-hidden="true">{LOCALE_META[next].flag}</span>
    </button>
  )
}
