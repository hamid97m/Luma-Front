import { useState } from 'react'
import { usePremiumStore } from '../../store.js'
import { t } from '../../i18n.js'
import { formatFullDate } from '../../i18n/format.js'
import { PaywallSheet } from './PaywallSheet.js'
import { Badge, Button, Card, Icon } from '../ui'

const DAY_MS = 86_400_000

export function PremiumCard() {
  const status = usePremiumStore((s) => s.status)
  const [paywallOpen, setPaywallOpen] = useState(false)

  const premiumUntil = status?.premiumUntil ? new Date(status.premiumUntil) : null
  const isActive = premiumUntil != null && premiumUntil.getTime() > Date.now()

  let content: React.ReactNode = null

  if (status && isActive) {
    const diffDays = (premiumUntil!.getTime() - Date.now()) / DAY_MS
    const remainingLabel = diffDays < 1 ? t.premium.endsToday : t.premium.daysLeft(Math.ceil(diffDays))
    content = (
      <Card variant="filled">
        <div className="flex items-center justify-between mb-1">
          <span className="text-txt font-medium text-[16px] flex items-center gap-2">
            <Icon name="star" size={16} className="text-primary" />
            {t.premium.title}
          </span>
          <Badge tone="primary">{t.premium.active}</Badge>
        </div>
        <p className="text-txt text-[14px]">{remainingLabel}</p>
        <p className="text-txt2 text-[12px] mt-1">{t.premium.until(formatFullDate(premiumUntil!))}</p>
      </Card>
    )
  } else if (status && !isActive && status.enabled) {
    content = (
      <div
        className="rounded-m3-xl p-[18px] text-white"
        style={{ background: 'linear-gradient(135deg, var(--pr), var(--prh))' }}
      >
        <p className="font-medium text-[18px] mb-1 flex items-center gap-2">
          <Icon name="sparkles" size={18} />
          {t.premium.title}
        </p>
        <p className="text-white/85 text-[13px] mb-3.5 leading-snug">{t.premium.pitch}</p>
        <Button onClick={() => setPaywallOpen(true)} variant="tonal">
          {t.premium.getButton}
        </Button>
      </div>
    )
  }

  // The sheet is rendered unconditionally (not nested inside the upsell
  // branch above) so that a successful purchase — which flips `content` from
  // the upsell card to the active card via the store refresh — doesn't
  // unmount PaywallSheet mid-flight. Unmounting it would trip its
  // mountedRef guard and skip the success haptic + close sequence.
  if (!content && !paywallOpen) return null

  return (
    <>
      {content}
      <PaywallSheet open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </>
  )
}
