import { useState } from 'react'
import { usePremiumStore } from '../../store.js'
import { t } from '../../i18n.js'
import { PaywallSheet } from './PaywallSheet.js'

const DAY_MS = 86_400_000

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[24px] p-4 border border-[#ec4067]/40"
      style={{ background: 'rgba(236,64,103,.08)' }}
    >
      <div
        className="h-1 rounded-full mb-4 -mx-4 -mt-4"
        style={{ background: 'linear-gradient(90deg,#f43f5e,#ec4067,#a855f7)' }}
      />
      {children}
    </div>
  )
}

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
      <CardShell>
        <div className="flex items-center justify-between mb-1">
          <span className="text-white font-bold text-[15px]">{t.premium.title} ⭐</span>
          <span className="bg-[#ec4067] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
            {t.premium.active}
          </span>
        </div>
        <p className="text-white/85 text-[14px]">{remainingLabel}</p>
        <p className="text-white/50 text-[12px] mt-1">{t.premium.until(premiumUntil!.toLocaleDateString())}</p>
      </CardShell>
    )
  } else if (status && !isActive && status.enabled) {
    content = (
      <CardShell>
        <p className="text-white font-bold text-[15px] mb-1">{t.premium.title} ⭐</p>
        <p className="text-white/70 text-[13px] mb-3">{t.premium.pitch}</p>
        <button onClick={() => setPaywallOpen(true)} className="btn-primary">
          {t.premium.getButton}
        </button>
      </CardShell>
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
