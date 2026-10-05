import { haptic } from '../telegram.js'
import { LOCALES, LOCALE_META, type Locale } from '../i18n/locale.js'
import { Icon } from './ui/index.js'

interface Props {
  value: Locale
  onChange: (locale: Locale) => void
}

/** Three-row language list shared by the first-open picker and Settings.
 * Row = the Settings-sheet row pattern; selected = the Chip selected tokens.
 * The row follows the screen direction (so the check column stays aligned);
 * only the label carries its own `lang`/`dir` so each native name renders in
 * its own script direction. */
export function LanguageOptions({ value, onChange }: Props) {
  return (
    <div role="radiogroup" className="flex flex-col gap-2.5">
      {LOCALES.map((l) => {
        const selected = l === value
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              haptic.selection()
              onChange(l)
            }}
            className={`w-full text-start rounded-m3-lg p-4 flex items-center justify-between transition-colors ${
              selected ? 'bg-primary-container text-on-primary-container' : 'bg-surface text-txt hover:bg-surface-high'
            }`}
          >
            <span className="flex items-center gap-3">
              {/* Decorative — the native name is the accessible label. */}
              <span aria-hidden="true" className="text-[22px] leading-none">
                {LOCALE_META[l].flag}
              </span>
              <span lang={l} dir={LOCALE_META[l].dir} className="text-[15px] font-medium">
                {LOCALE_META[l].nativeName}
              </span>
            </span>
            {selected && <Icon name="check" size={18} className="flex-none" />}
          </button>
        )
      })}
    </div>
  )
}
