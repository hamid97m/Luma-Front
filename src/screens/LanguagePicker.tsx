import { useEffect, useRef, useState } from 'react'
import { messagesFor, useLocaleStore } from '../i18n.js'
import { LOCALE_META, pickDefaultLocale, type Locale } from '../i18n/locale.js'
import { geoCountrySync, prefetchGeoCountry } from '../i18n/geo.js'
import { mainButtonSupported, useMainButton } from '../telegram.js'
import { Button } from '../components/ui/index.js'
import { LanguageOptions } from '../components/LanguageOptions.js'

interface Props {
  onDone: () => void
}

const telegramLang = () => window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code

/** First-open language choice. The preselected row comes from Telegram's
 * language, falling back to the IP country when Telegram is not decisive
 * (see pickDefaultLocale). Tapping a row only changes a local preview (title,
 * subtitle, button and direction follow the highlighted locale) — it must NOT
 * touch the store, because `main.tsx` remounts the whole App on a store change
 * and that would reset this screen mid-choice. Continue commits the choice
 * (store + localStorage) and moves on; the server copy is sent with the
 * onboarding profile save. */
export function LanguagePicker({ onDone }: Props) {
  const [preview, setPreview] = useState<Locale>(() => pickDefaultLocale(telegramLang(), geoCountrySync()))
  // Once the user taps a row, a late geo answer must not override their pick.
  const touched = useRef(false)
  const copy = messagesFor(preview).language

  // App prefetches the country as soon as it knows the picker is coming, so
  // this normally resolves immediately from the memoised result.
  useEffect(() => {
    let alive = true
    prefetchGeoCountry().then((country) => {
      if (alive && !touched.current && country) setPreview(pickDefaultLocale(telegramLang(), country))
    })
    return () => { alive = false }
  }, [])

  const choose = (l: Locale) => {
    touched.current = true
    setPreview(l)
  }

  const done = () => {
    useLocaleStore.getState().setLocale(preview)
    onDone()
  }

  // Same Main Button hook + fallback Button pattern as Onboarding.
  useMainButton({ text: copy.continue, visible: true, onClick: done })

  return (
    <div
      className="h-full flex flex-col bg-bg"
      style={{ paddingTop: 'var(--tg-safe-top)' }}
      lang={preview}
      dir={LOCALE_META[preview].dir}
    >
      <div className="flex-1 overflow-y-auto px-5">
        <div className="pt-10 mb-6">
          <h2 className="text-[28px] font-medium leading-tight text-txt">{copy.title}</h2>
          <p className="text-[13px] text-txt2 mt-1.5">{copy.subtitle}</p>
        </div>
        <LanguageOptions value={preview} onChange={choose} />
      </div>

      {/* Sticky bottom button — fallback when Telegram provides no MainButton */}
      {!mainButtonSupported() && (
        <div className="relative z-10 px-6 pb-10 pt-4">
          <Button block size="lg" onClick={done}>
            {copy.continue}
          </Button>
        </div>
      )}
    </div>
  )
}
