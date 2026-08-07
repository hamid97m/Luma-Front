// Shared empty-state block — the mockup's centered primary-container tile with
// title/subtitle, brought alive with the design's motion language: the icon
// tile beats (lumaBeat, like the splash logo) over a few ambient hearts that
// drift upward (lumaFloat). Used by every "nothing here yet" screen so they're
// visually identical.
import { Icon, type IconName } from './Icon.js'

export interface EmptyStateProps {
  icon: IconName
  title: string
  subtitle?: string
}

// Ambient background hearts (primary-tinted, low opacity) drifting up.
const HEARTS = [
  { size: 16, left: '16%', bottom: 90, opacity: 0.1, dur: 6.5, delay: 0 },
  { size: 22, left: '74%', bottom: 70, opacity: 0.09, dur: 7.8, delay: 1.4 },
  { size: 13, left: '50%', bottom: 60, opacity: 0.12, dur: 5.6, delay: 2.6 },
  { size: 18, left: '34%', bottom: 110, opacity: 0.08, dur: 7.1, delay: 0.8 },
]

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className="relative flex-1 min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center p-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {HEARTS.map((h, i) => (
          <Icon
            key={i}
            name="heart"
            size={h.size}
            className="absolute text-primary"
            style={{
              left: h.left,
              bottom: h.bottom,
              opacity: h.opacity,
              animation: `lumaFloat ${h.dur}s linear ${h.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <div
        className="relative w-[72px] h-[72px] rounded-3xl bg-primary-container text-primary flex items-center justify-center"
        style={{ animation: 'lumaBeat 1.6s ease-in-out infinite' }}
      >
        <Icon name={icon} size={32} filled={false} />
      </div>
      <h2 className="relative text-[22px] font-medium text-txt">{title}</h2>
      {subtitle && <p className="relative text-txt2 text-[14px] max-w-[260px]">{subtitle}</p>}
    </div>
  )
}
