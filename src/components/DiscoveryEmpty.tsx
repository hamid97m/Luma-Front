// Discovery "all caught up" empty state — matches the Luma Material mockup:
// two rippling rings behind a gently bobbing heart tile flanked by bobbing
// sparkles, then a heading/subtitle and a refresh action.
import { Button, Icon } from './ui/index.js'
import { t } from '../i18n.js'

interface Props {
  /** "Review profiles again" — re-checks the feed for new people. */
  onReview: () => void
}

export function DiscoveryEmpty({ onReview }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-10 py-8">
      <div className="relative w-[180px] h-[180px] flex items-center justify-center flex-none">
        <span
          className="absolute rounded-full border-[1.5px] border-primary"
          style={{ inset: 34, animation: 'lumaRipple 2.6s ease-out infinite' }}
        />
        <span
          className="absolute rounded-full border-[1.5px] border-primary"
          style={{ inset: 34, animation: 'lumaRipple 2.6s ease-out 1.3s infinite' }}
        />
        <div
          className="relative w-[88px] h-[88px] rounded-m3-xl bg-primary-container text-primary flex items-center justify-center"
          style={{ boxShadow: '0 6px 20px rgba(176,41,92,.18)', animation: 'lumaBob 3.2s ease-in-out infinite' }}
        >
          <Icon name="heart" size={38} />
        </div>
        <span
          className="absolute text-primary"
          style={{ top: 22, right: 30, opacity: 0.5, animation: 'lumaBob 2.6s ease-in-out .4s infinite' }}
        >
          <Icon name="sparkle" size={14} />
        </span>
        <span
          className="absolute text-primary"
          style={{ bottom: 30, left: 24, opacity: 0.35, animation: 'lumaBob 3s ease-in-out 1.1s infinite' }}
        >
          <Icon name="sparkle" size={10} />
        </span>
      </div>

      <h2 className="text-[22px] font-medium text-txt">{t.discovery.empty}</h2>
      <p className="text-txt2 text-[14px] leading-relaxed max-w-[240px] mb-3">
        {t.discovery.emptyHint}
      </p>
      <Button onClick={onReview}>{t.discovery.reviewAgain}</Button>
    </div>
  )
}
