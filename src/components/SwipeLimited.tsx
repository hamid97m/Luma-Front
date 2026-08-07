// Discovery swipe-limit state — countdown ring until the 4h window refills,
// plus a premium pitch card. Shown instead of the card stack.
import { useEffect, useState } from 'react'
import { t } from '../i18n.js'
import { formatCountdown } from '../utils/premium.js'
import { Button, Icon } from './ui/index.js'

const WINDOW_MS = 4 * 60 * 60 * 1000
const RING_R = 66
const RING_C = 2 * Math.PI * RING_R

interface Props {
  /** ISO time the window refills. */
  resetAt: string
  /** Fired once when the countdown reaches zero. */
  onExpired: () => void
  onGetPremium: () => void
}

export function SwipeLimited({ resetAt, onExpired, onGetPremium }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const left = Math.max(0, new Date(resetAt).getTime() - now)
  const expired = left <= 0

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (expired) onExpired()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired])

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8 pt-12 pb-6 overflow-y-auto">
      <div className="relative w-[150px] h-[150px] flex-none mb-2">
        <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90">
          <circle cx="75" cy="75" r={RING_R} fill="none" strokeWidth="8" stroke="currentColor" className="text-primary-container" />
          <circle
            cx="75" cy="75" r={RING_R} fill="none" strokeWidth="8" strokeLinecap="round"
            stroke="currentColor" className="text-primary"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - left / WINDOW_MS)}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-[26px] font-medium text-txt tabular-nums">{formatCountdown(left)}</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-txt3">{t.swipeLimit.untilRefill}</span>
        </div>
      </div>

      <h2 className="text-[22px] font-medium text-txt">{t.swipeLimit.title}</h2>
      <p className="text-txt2 text-[14px] leading-relaxed max-w-[250px]">{t.swipeLimit.body}</p>

      <div className="mt-3.5 w-full bg-primary-container text-on-primary-container rounded-m3-xl p-4 flex flex-col gap-3 items-center">
        <div className="flex items-center gap-2">
          <Icon name="sparkle" size={18} className="text-primary" />
          <span className="text-[15px] font-medium">{t.swipeLimit.pitchTitle}</span>
        </div>
        <p className="text-[13px] leading-snug opacity-80">{t.swipeLimit.pitchBody}</p>
        <Button onClick={onGetPremium} block>{t.premium.getButton}</Button>
      </div>
    </div>
  )
}
