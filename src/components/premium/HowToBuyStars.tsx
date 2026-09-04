import { t } from '../../i18n.js'
import { haptic, openLink, useBackButton } from '../../telegram.js'
import { Icon } from '../ui'

interface HowToBuyStarsProps {
  onClose: () => void
  /**
   * When opened from the paywall, the selected plan's Star price — shown in the
   * info card / step 3 and passed on to the Asan Star shop so it opens
   * pre-filled with the exact package (same link behaviour the paywall used
   * before this page existed).
   */
  packageStars?: number
  /** The selected plan's title, shown in the "you need ★N for {plan}" card. */
  planTitle?: string
}

// Iran-friendly Stars reseller (asanstar). Kept identical to the previous
// paywall button: same host + referral, package appended when we know it.
const ASANSTAR_URL = 'https://hub.asanstars.com/shop/stars?ref=24JMEBKK'

export function HowToBuyStars({ onClose, packageStars, planTitle }: HowToBuyStarsProps) {
  // Sits on top of the (still-open) paywall via the shared LIFO back-stack, so
  // the header arrow / Android back dismisses this page first, not the sheet.
  useBackButton(true, onClose)

  const c = t.howToBuyStars

  const openReseller = (url: string) => {
    haptic.impact('light')
    openLink(url)
  }

  const openAsanstar = () => {
    haptic.impact('medium')
    openLink(packageStars ? `${ASANSTAR_URL}&package=${packageStars}` : ASANSTAR_URL)
  }

  // Step-number badge — primary fill for step 1, tonal for the follow-ups.
  const StepBadge = ({ n, tone }: { n: number; tone: 'primary' | 'tonal' }) => (
    <span
      className={`flex-none w-[26px] h-[26px] rounded-full text-[13px] font-bold flex items-center justify-center ${
        tone === 'primary'
          ? 'bg-primary text-white'
          : 'bg-primary-container text-on-primary-container'
      }`}
    >
      {n}
    </span>
  )

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[60] bg-bg text-txt font-fa flex flex-col"
      style={{ paddingTop: 'var(--tg-safe-top)' }}
    >
      {/* Header — in-page chevron mirrors the native back button (useBackButton). */}
      <div className="flex items-center gap-2 px-4 h-14 flex-none border-b border-surface">
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 flex text-txt"
          aria-label={t.premium.close}
        >
          <Icon name="chevron-right" size={22} />
        </button>
        <h1 className="text-[18px] font-semibold text-txt m-0">{c.title}</h1>
      </div>

      <div
        className="flex-1 overflow-y-auto px-5 pt-4"
        style={{ paddingBottom: 'calc(1.5rem + var(--tg-safe-bottom, 0px))' }}
      >
        {/* Info card — how many Stars this plan needs + what a Star is. */}
        <div className="flex items-center gap-3 bg-surface rounded-m3-lg px-4 py-3.5">
          <Icon name="sparkle" size={26} className="text-gold flex-none" />
          <div className="min-w-0">
            <p className="m-0 text-[14px] font-bold text-txt">
              {packageStars != null ? (
                <>
                  {c.needTitle(planTitle ?? t.premium.title)}{' '}
                  <span className="text-primary">★{packageStars}</span> {c.needTitleAfter}
                </>
              ) : (
                c.needTitleGeneric
              )}
            </p>
            <p className="mt-1 mb-0 text-[12px] leading-loose text-txt2">{c.whatBody}</p>
          </div>
        </div>

        {/* Step 1 — buy Stars from a reseller. */}
        <div className="flex items-start gap-3 mt-5">
          <StepBadge n={1} tone="primary" />
          <div className="min-w-0 flex-1">
            <p className="mt-0.5 mb-2.5 text-[14px] font-bold text-txt">{c.step1Title}</p>

            {/* Recommended: Asan Star */}
            <div
              className="rounded-m3-md border-[1.5px] border-primary p-3.5"
              style={{ background: 'var(--prtint)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold text-txt">{c.asanName}</span>
                <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {c.asanBadge}
                </span>
              </div>
              <p className="mt-1.5 mb-2.5 text-[12px] leading-loose text-txt2">{c.asanBody}</p>
              <button
                type="button"
                onClick={openAsanstar}
                className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-full px-4 py-2.5 text-[13.5px] font-semibold transition-opacity active:opacity-80"
              >
                <Icon name="star" size={14} className="flex-none" />
                {packageStars != null ? c.asanButton(packageStars) : c.asanButtonGeneric}
              </button>
            </div>

            {/* Other rial resellers */}
            <div className="flex flex-col gap-1.5 mt-2">
              {c.resellers.map((r) => (
                <button
                  key={r.domain}
                  type="button"
                  onClick={() => openReseller(r.url)}
                  className="w-full flex items-center gap-2.5 bg-field border border-outline rounded-m3-sm px-3.5 py-2.5 transition-colors hover:bg-surface"
                >
                  <span className="flex-1 min-w-0 text-right text-[13.5px] font-semibold text-txt">
                    {r.name}
                    <span className="font-normal text-[11.5px] text-txt2"> · {r.domain}</span>
                  </span>
                  <Icon name="external-link" size={13} className="text-primary flex-none" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Step 2 — Stars arrive in the Telegram account. */}
        <div className="flex items-start gap-3 mt-[18px]">
          <StepBadge n={2} tone="tonal" />
          <div className="min-w-0">
            <p className="mt-0.5 mb-0 text-[14px] font-bold text-txt">{c.step2Title}</p>
            <p className="mt-1 mb-0 text-[12px] leading-loose text-txt2">{c.step2Body}</p>
          </div>
        </div>

        {/* Step 3 — return and activate premium. */}
        <div className="flex items-start gap-3 mt-[18px]">
          <StepBadge n={3} tone="tonal" />
          <div className="min-w-0">
            <p className="mt-0.5 mb-0 text-[14px] font-bold text-txt">{c.step3Title}</p>
            <p className="mt-1 mb-0 text-[12px] leading-loose text-txt2">
              {packageStars != null ? c.step3Body(packageStars) : c.step3BodyGeneric}
            </p>
          </div>
        </div>
      </div>

      {/* Sticky footer — return to the paywall to pay. */}
      <div
        className="flex-none px-5 pt-3 border-t border-surface bg-bg"
        style={{ paddingBottom: 'calc(2rem + var(--tg-safe-bottom, 0px))' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="w-full h-12 rounded-full bg-gold-btn text-[#241A00] font-semibold text-[14.5px] transition-opacity active:opacity-80"
        >
          {c.doneButton}
        </button>
      </div>
    </div>
  )
}
