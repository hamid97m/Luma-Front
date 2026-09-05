import { t } from '../../i18n.js'
import { Icon, Sheet } from '../ui'

interface RewindSheetProps {
  open: boolean
  onClose: () => void
  onGoPremium: () => void
}

// Premium teaser shown when a non-premium user taps the discovery "rewind"
// button. Its "get premium" CTA opens the real PaywallSheet (same two-step
// pattern as DirectChatSheet → PaywallSheet).
export function RewindSheet({ open, onClose, onGoPremium }: RewindSheetProps) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="flex flex-col items-center text-center pb-2">
        <div className="relative w-14 h-14 rounded-[18px] bg-primary-container text-on-primary-container flex items-center justify-center">
          <Icon name="arrow-left" size={26} strokeWidth={2} />
          <span className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-gold-btn flex items-center justify-center text-[#241A00]">
            <Icon name="star" size={13} filled />
          </span>
        </div>

        <h2 className="mt-3.5 text-[19px] font-semibold text-txt">{t.rewind.title}</h2>
        <p className="mt-2.5 text-[13.5px] leading-[1.9] text-txt2">{t.rewind.body}</p>

        <button
          onClick={onGoPremium}
          className="w-full h-12 mt-5 rounded-full bg-primary text-white font-medium text-[14.5px] hover:bg-primary-hover transition-colors"
        >
          {t.rewind.getPremium}
        </button>
        <button
          onClick={onClose}
          className="w-full h-11 mt-2 rounded-full text-primary font-medium text-[14px]"
        >
          {t.rewind.cancel}
        </button>
      </div>
    </Sheet>
  )
}
