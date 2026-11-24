// Round country flags drawn as SVG. Emoji flags sit off-centre (font metrics),
// are rectangular or wavy, and some systems show letters instead.
import { useId } from 'react'

interface Props {
  flag: 'fa' | 'en'
  size?: number
}

export function RoundFlag({ flag, size = 28 }: Props) {
  const clip = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" data-flag={flag} aria-hidden="true" className="block flex-none">
      <defs><clipPath id={clip}><circle cx="16" cy="16" r="16" /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>
        {flag === 'fa' ? (
          <>
            <rect width="32" height="32" fill="#fff" />
            <rect width="32" height="10.67" fill="#239F40" />
            <rect y="21.33" width="32" height="10.67" fill="#DA0000" />
            {/* Emblem, simplified: at this size only its outline reads. */}
            <g fill="none" stroke="#DA0000" strokeWidth="1.1" strokeLinecap="round">
              <path d="M16 12.6v6.8" />
              <path d="M14.2 13.2c-2.2 1.6-2.2 4.4.6 6" />
              <path d="M17.8 13.2c2.2 1.6 2.2 4.4-.6 6" />
            </g>
          </>
        ) : (
          <>
            <rect width="32" height="32" fill="#012169" />
            <path d="M0 0 32 32M32 0 0 32" stroke="#fff" strokeWidth="6.4" />
            <path d="M0 0 32 32M32 0 0 32" stroke="#C8102E" strokeWidth="2.6" />
            <path d="M16 0v32M0 16h32" stroke="#fff" strokeWidth="10" />
            <path d="M16 0v32M0 16h32" stroke="#C8102E" strokeWidth="6" />
          </>
        )}
      </g>
      <circle cx="16" cy="16" r="15.5" fill="none" stroke="#000" strokeOpacity="0.14" />
    </svg>
  )
}
