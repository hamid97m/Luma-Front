// Matches "no matches yet" empty state — matches the Luma Material mockup: a
// dashed placeholder circle and the user's own avatar, both gently bobbing,
// joined by a beating heart badge, then heading/subtitle and a CTA that jumps
// to the Discovery tab.
import { useAuthStore } from '../store.js'
import { Avatar, Button, Icon } from './ui/index.js'

interface Props {
  /** Switches to the Discovery tab. */
  onStartDiscovering: () => void
}

export function MatchesEmpty({ onStartDiscovering }: Props) {
  const me = useAuthStore((s) => s.user)
  const myPhoto = me?.photos?.[0]?.url ?? null

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-10 pb-12">
      <div className="relative w-[150px] h-[110px] flex-none mb-1.5">
        {/* Left: dashed placeholder (the someone you haven't met yet) */}
        <div
          className="absolute w-[72px] h-[72px] rounded-full border-2 border-dashed border-outline bg-surface"
          style={{ left: 12, top: 18, animation: 'lumaBob 3.4s ease-in-out infinite' }}
        />
        {/* Right: you */}
        <div
          className="absolute w-[72px] h-[72px] rounded-full"
          style={{ right: 12, top: 18, boxShadow: '0 4px 14px rgba(176,41,92,.22)', animation: 'lumaBob 3.4s ease-in-out 1.7s infinite' }}
        >
          <Avatar src={myPhoto} alt="You" size={72} />
        </div>
        {/* Center: the spark, sitting between the two avatars */}
        <div
          className="absolute z-10 w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center"
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', boxShadow: '0 4px 12px rgba(176,41,92,.35)', animation: 'lumaBeat 1.6s ease-in-out infinite' }}
        >
          <Icon name="heart" size={16} />
        </div>
      </div>

      <h2 className="text-[22px] font-medium text-txt">No matches yet</h2>
      <p className="text-txt2 text-[14px] leading-relaxed max-w-[240px] mb-3">
        When you and someone like each other, you'll meet here. Your future match is one swipe away.
      </p>
      <Button onClick={onStartDiscovering}>Start discovering</Button>
    </div>
  )
}
