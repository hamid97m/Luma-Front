import { t } from '../../i18n.js'
import { haptic, openLink, useBackButton } from '../../telegram.js'
import { Icon } from '../ui'

interface HowToBuyStarsProps {
  onClose: () => void
  /**
   * When opened from the paywall, the selected plan's Star price — passed on to
   * the Asan Star shop so it opens pre-filled with the exact package (same link
   * behaviour the paywall used before this page existed).
   */
  packageStars?: number
}

// Iran-friendly Stars reseller (asanstar). Kept identical to the previous
// paywall button: same host + referral, package appended when we know it.
const ASANSTAR_URL = 'https://hub.asanstars.com/shop/stars?ref=24JMEBKK'

export function HowToBuyStars({ onClose, packageStars }: HowToBuyStarsProps) {
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

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-bg text-txt font-fa flex flex-col overflow-y-auto"
      style={{ paddingTop: 'var(--tg-safe-top)' }}
    >
      {/* Header — back chevron (RTL) + centered title, balanced by a spacer */}
      <div className="flex items-center px-2 h-14 flex-none">
        <button
          type="button"
          onClick={onClose}
          aria-label={c.title}
          className="w-10 h-10 flex items-center justify-center rounded-full text-txt2 transition-colors hover:bg-surface"
        >
          <Icon name="chevron-right" size={24} />
        </button>
        <h1 className="flex-1 text-center text-[18px] font-bold text-txt m-0">{c.title}</h1>
        <div className="w-10 flex-none" aria-hidden />
      </div>

      <div
        className="flex-1 px-4 pt-1 flex flex-col gap-4"
        style={{ paddingBottom: 'calc(2rem + var(--tg-safe-bottom, 0px))' }}
      >
        {/* What is a Star? */}
        <div className="bg-primary-container rounded-m3-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="sparkle" size={18} className="text-gold flex-none" />
            <h2 className="text-[15px] font-bold text-on-primary-container m-0">{c.whatTitle}</h2>
          </div>
          <p className="m-0 text-[13px] leading-loose text-on-primary-container text-justify">
            {c.whatBody}
          </p>
        </div>

        {/* Rial resellers */}
        <div className="flex flex-col gap-2.5">
          <p className="text-[12px] text-txt3 text-right m-0">{c.resellersLabel}</p>
          {c.resellers.map((r) => (
            <button
              key={r.domain}
              type="button"
              onClick={() => openReseller(r.url)}
              className="w-full bg-surface rounded-m3-md px-4 py-3.5 flex items-center gap-3 transition-colors hover:bg-surface-high"
            >
              <span className="flex-1 text-right text-[14px] text-txt">
                <span className="font-bold">{r.name}</span>
                <span className="text-txt3"> · {r.domain}</span>
              </span>
              <Icon name="external-link" size={16} className="text-primary flex-none" />
            </button>
          ))}
        </div>

        {/* Recommended: Asan Star */}
        <div className="rounded-m3-lg border-2 border-primary bg-primary-container p-4">
          <h2 className="text-[15px] font-bold text-txt text-right m-0 mb-1.5">{c.recommendTitle}</h2>
          <p className="text-[13px] leading-relaxed text-txt2 text-right m-0 mb-3.5">{c.recommendBody}</p>
          <button
            type="button"
            onClick={openAsanstar}
            className="w-full h-12 rounded-full bg-primary text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-opacity active:opacity-80"
          >
            {c.recommendButton}
            <Icon name="star" size={17} className="flex-none" />
          </button>
        </div>
      </div>
    </div>
  )
}
