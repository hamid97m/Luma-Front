import { t } from '../../i18n.js'

/**
 * "typing" + three pulsing dots, inline. Inherits font size and color from
 * its parent; the dots are tiny so the line height never changes.
 */
export function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 max-w-full">
      <span className="truncate">{t.chat.typing}</span>
      <span aria-hidden="true" className="inline-flex items-center gap-[3px] flex-none">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1 h-1 rounded-full bg-current"
            style={{ animation: `lumaDot 1.4s ease-in-out ${i * 0.18}s infinite` }}
          />
        ))}
      </span>
    </span>
  )
}
