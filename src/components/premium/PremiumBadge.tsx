import { t } from '../../i18n.js'

interface Props {
  size?: number
}

/** Blue verification check, in the style of the X badge. Premium members only. */
export function PremiumBadge({ size = 18 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={t.premium.badge}
      className="flex-none"
    >
      <circle cx="12" cy="12" r="12" fill="#1D9BF0" />
      <path
        d="M7.2 12.4 10.4 15.6 16.8 8.6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
