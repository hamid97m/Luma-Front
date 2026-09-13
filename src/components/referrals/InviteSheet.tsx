import { useEffect, useState } from 'react'
import { t } from '../../i18n.js'
import { formatFullDate } from '../../i18n/format.js'
import { haptic, openTelegramLink } from '../../telegram.js'
import { useReferralStore, usePremiumStore } from '../../store.js'
import { fillPercent, grantedCount, newlyGranted, sheetVariant, stageNumber } from '../../utils/referral.js'
import { Icon, Sheet } from '../ui/index.js'
import type { ReferralMilestone, ReferralStatus } from '../../types.js'

const SEEN_KEY = 'luma_referral_granted_seen'

// Fixed stagger so the confetti burst is the same each time the reward
// variant is shown (no per-render randomness) — 4 colors from the design.
const CONFETTI = [
  { left: '6%', color: 'var(--pr)', delay: '0s', duration: '2.6s' },
  { left: '20%', color: 'var(--gold)', delay: '.15s', duration: '3.4s' },
  { left: '34%', color: '#6BAF92', delay: '.05s', duration: '2.9s' },
  { left: '50%', color: '#5B8DEF', delay: '.25s', duration: '3.1s' },
  { left: '64%', color: 'var(--pr)', delay: '.1s', duration: '2.5s' },
  { left: '78%', color: 'var(--gold)', delay: '.3s', duration: '3.3s' },
  { left: '92%', color: '#6BAF92', delay: '.2s', duration: '2.7s' },
]

function rewardLine(m: ReferralMilestone): string {
  return m.rewardType === 'premium_days' ? t.referral.tierPremium(m.rewardAmount) : t.referral.tierSwipes(m.rewardAmount)
}

// Milestone invite bottom sheet — self-contained (reads useReferralStore
// itself). Rendered once at the app root; opened via useReferralStore.openSheet().
//
// This outer component stays mounted for the whole app session (it's the same
// element in the same tree position every render), so any hook state declared
// directly here would persist across opens/closes instead of resetting. The
// actual sheet body is split into `InviteSheetContent`, which this component
// only adds to the tree while `sheetOpen && status` — so it fully unmounts on
// close and remounts fresh (including its `seenGranted` useState initializer
// re-reading localStorage) on every reopen.
export function InviteSheet() {
  const status = useReferralStore((s) => s.status)
  const sheetOpen = useReferralStore((s) => s.sheetOpen)
  const closeSheet = useReferralStore((s) => s.closeSheet)

  useEffect(() => {
    if (sheetOpen) useReferralStore.getState().refresh()
  }, [sheetOpen])

  if (!sheetOpen || !status) return null

  return <InviteSheetContent status={status} onClose={closeSheet} />
}

function InviteSheetContent({ status, onClose }: { status: ReferralStatus; onClose: () => void }) {
  const premiumUntilRaw = usePremiumStore((s) => s.status?.premiumUntil)

  // Re-read fresh on every mount (i.e. every time the sheet opens — see the
  // note on InviteSheet above), then stays stable for as long as this
  // instance is mounted, even after markSeen() updates localStorage on close.
  const [seenGranted] = useState(() => Number(localStorage.getItem(SEEN_KEY) ?? '0'))
  const [copied, setCopied] = useState(false)

  const milestone = newlyGranted(status.milestones, seenGranted)

  // A freshly-granted premium reward needs the premium store refreshed once,
  // on open, so the banner's "until <date>" reflects the just-applied expiry.
  useEffect(() => {
    if (milestone?.rewardType === 'premium_days') usePremiumStore.getState().refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(id)
  }, [copied])

  const variant = sheetVariant(status, seenGranted)
  const qualifiedCount = status.qualifiedCount
  // Defensive: render/derive in ascending tier order even if the API ever
  // returns milestones out of order (the 1/3/10 rail math assumes ascending).
  const milestones = [...status.milestones].sort((a, b) => a.count - b.count)
  const nextMilestone = milestones.find((m) => m.count > qualifiedCount) ?? null
  const link = status.link ?? ''
  const displayLink = link.replace(/^https?:\/\//, '')
  const premiumUntil = premiumUntilRaw ? new Date(premiumUntilRaw) : null

  const markSeen = () => {
    localStorage.setItem(SEEN_KEY, String(grantedCount(status.milestones)))
  }

  const handleClose = () => {
    markSeen()
    onClose()
  }

  const handleContinue = () => {
    markSeen()
    onClose()
  }

  const handleCopy = () => {
    haptic.selection()
    try {
      void navigator.clipboard?.writeText(link)
    } catch {
      /* clipboard unavailable — ignore, the link is still visible/shareable */
    }
    setCopied(true)
  }

  const handleShare = () => {
    haptic.impact('light')
    if (!link) return
    openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(t.referral.shareText))
  }

  const headline =
    variant === 'reward' ? t.referral.headlineReward : variant === 'complete' ? t.referral.headlineComplete : t.referral.headlineDefault
  const sub =
    variant === 'fresh' ? t.referral.subFresh
      : variant === 'reward' ? t.referral.subReward
        : variant === 'complete' ? t.referral.subComplete
          : t.referral.subProgress

  const progressText =
    qualifiedCount === 0 ? t.referral.progressFresh
      : qualifiedCount >= 10 ? t.referral.progressDone(qualifiedCount)
        : t.referral.progressOf(qualifiedCount, nextMilestone?.count ?? qualifiedCount)
  const stageText = qualifiedCount >= 10 ? t.referral.stageComplete : t.referral.stage(stageNumber(qualifiedCount))

  return (
    <Sheet open onClose={handleClose} title={t.referral.sheetTitle}>
      <div className="flex flex-col pb-2">
        {variant === 'reward' && (
          <div className="relative h-0">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 overflow-hidden">
              {CONFETTI.map((c, i) => (
                <span
                  key={i}
                  className="absolute top-0 w-2 h-2 rounded-[2px]"
                  style={{ left: c.left, background: c.color, animation: `luma-confetti ${c.duration} ease-in ${c.delay} both` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-m3-md bg-primary-container text-primary flex items-center justify-center flex-none">
            <Icon name="gift" size={26} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[19px] font-semibold text-txt leading-snug">{headline}</p>
            <p className="text-[13px] text-txt2 mt-0.5">{sub}</p>
          </div>
        </div>

        {variant === 'reward' && milestone && (
          <div className="bg-primary-container rounded-m3-md p-3.5 flex items-center gap-3 mt-4 animate-[luma-pop_.45s_ease-out_both]">
            <span className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center flex-none">
              <Icon name="check" size={18} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold text-on-primary-container">
                {milestone.rewardType === 'premium_days'
                  ? t.referral.rewardBannerPremium(milestone.rewardAmount)
                  : t.referral.rewardBannerSwipes(milestone.rewardAmount)}
              </span>
              <span className="block text-[12px] text-on-primary-container opacity-70">
                {milestone.rewardType === 'premium_days' && premiumUntil
                  ? t.referral.rewardBannerUntil(formatFullDate(premiumUntil))
                  : t.referral.rewardBannerAdded}
              </span>
            </span>
          </div>
        )}

        {/* Milestone stepper */}
        <div className="bg-surface rounded-m3-lg p-4 mt-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] font-medium text-txt">{progressText}</span>
            <span className="text-[12px] text-txt2">{stageText}</span>
          </div>

          <div className="relative">
            <div className="absolute h-[5px] rounded-full bg-surface-high" style={{ right: '16.6%', left: '16.6%', top: '15px' }}>
              <div
                className="absolute inset-y-0 right-0 rounded-full bg-primary"
                style={{ width: `${fillPercent(qualifiedCount)}%` }}
              />
            </div>
            <div className="relative flex">
              {milestones.map((m) => {
                const done = m.granted || m.achieved
                const isJustGranted = m.granted && milestone?.count === m.count
                return (
                  <div key={m.count} className="flex-1 flex flex-col items-center text-center gap-1.5">
                    <div
                      className={`w-[34px] h-[34px] rounded-full flex items-center justify-center text-[13px] font-semibold ${done ? 'bg-primary text-white' : 'bg-surface-high text-txt2'}`}
                    >
                      {done ? <Icon name="check" size={16} /> : m.count}
                    </div>
                    <span className="text-[11.5px] text-txt2">{t.referral.friendCount(m.count)}</span>
                    <span className={`text-[12.5px] ${done ? 'text-txt' : 'text-txt2'}`}>{rewardLine(m)}</span>
                    {done ? (
                      <span
                        className="mt-0.5 inline-flex items-center rounded-full bg-primary-container text-on-primary-container text-[11px] font-medium px-2 py-0.5"
                        style={isJustGranted ? { boxShadow: '0 0 0 4px var(--prtint)' } : undefined}
                      >
                        {isJustGranted ? t.referral.chipJustDone : t.referral.chipDone}
                      </span>
                    ) : (
                      <span className="mt-0.5 inline-flex items-center rounded-full border border-outline text-txt3 text-[11px] font-medium px-2 py-0.5">
                        {t.referral.chipRemaining(m.count - qualifiedCount)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Link row */}
        <div className="flex items-center gap-2 bg-field border border-outline rounded-m3-md px-3.5 py-1.5 mt-4">
          <span dir="ltr" className="flex-1 min-w-0 truncate text-left text-[13px] text-txt2">{displayLink}</span>
          <button
            type="button"
            aria-label={t.referral.copyAria}
            onClick={handleCopy}
            className="w-10 h-10 flex-none rounded-[12px] bg-primary-container text-primary flex items-center justify-center transition-colors"
          >
            {copied ? (
              <Icon name="check" size={18} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        </div>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={handleShare}
          className="w-full h-[54px] mt-4 rounded-full bg-primary text-white text-[16px] font-semibold flex items-center justify-center gap-2 transition-colors hover:bg-primary-hover"
        >
          <Icon name="send" size={18} />
          {t.referral.inviteCta}
        </button>

        {variant === 'reward' && (
          <button
            type="button"
            onClick={handleContinue}
            className="w-full h-[46px] mt-2.5 rounded-full border border-outline text-primary text-[14px] font-medium"
          >
            {t.referral.continueCta}
          </button>
        )}

        {variant === 'reward' && nextMilestone && (
          <p className="text-center text-[12px] text-txt2 mt-2.5">
            {t.referral.nextTierNote(nextMilestone.count - qualifiedCount, rewardLine(nextMilestone))}
          </p>
        )}

        <p className="text-center text-[11.5px] text-txt3 mt-4">{t.referral.footnote}</p>
      </div>
    </Sheet>
  )
}
