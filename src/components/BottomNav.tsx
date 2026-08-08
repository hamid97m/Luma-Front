import { t } from '../i18n.js'
import { haptic } from '../telegram.js'
import { Icon, Badge, type IconName } from './ui/index.js'

type Tab = 'discovery' | 'likes' | 'matches' | 'profile'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
  matchesBadge?: number
  likesBadge?: number
}

const TABS: Array<{ id: Tab; icon: IconName; label: string }> = [
  { id: 'discovery', icon: 'flame',   label: t.nav.discovery },
  { id: 'likes',     icon: 'heart',   label: t.nav.likes     },
  { id: 'matches',   icon: 'message', label: t.nav.matches   },
  { id: 'profile',   icon: 'user',    label: t.nav.profile   },
]

export function BottomNav({ active, onChange, matchesBadge, likesBadge }: Props) {
  return (
    <nav
      className="bg-surface flex gap-1 px-2 pt-2 flex-none"
      style={{ paddingBottom: 'max(24px, var(--tg-safe-bottom))' }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => {
              if (!isActive) haptic.selection()
              onChange(tab.id)
            }}
            className="relative flex-1 flex flex-col items-center pt-1.5 pb-1 gap-1"
            style={{ color: isActive ? 'var(--onpc)' : 'var(--tx2)' }}
          >
            {/* M3 active pill indicator */}
            <span
              className={`w-16 h-8 rounded-m3-md flex items-center justify-center transition-colors duration-200 ${
                isActive ? 'bg-primary-container' : 'bg-transparent'
              }`}
              style={isActive ? { animation: 'lumaNavPill .25s ease' } : undefined}
            >
              {/* Outlined + filled copies stacked; active state cross-fades to the
                  filled glyph with a springy scale-in, per the Luma Material mockup. */}
              <span
                className="relative flex w-5 h-5"
                style={isActive ? { animation: 'lumaNavPop .35s ease' } : undefined}
              >
                <Icon
                  name={tab.icon}
                  size={20}
                  filled={false}
                  style={{ transition: 'opacity .25s', opacity: isActive ? 0 : 1 }}
                />
                <Icon
                  name={tab.icon}
                  size={20}
                  filled
                  style={{
                    position: 'absolute',
                    inset: 0,
                    stroke: 'currentColor',
                    strokeWidth: 1,
                    transition: 'opacity .25s, transform .3s cubic-bezier(.2,.8,.3,1.4)',
                    opacity: isActive ? 1 : 0,
                    transform: `scale(${isActive ? 1 : 0.4})`,
                  }}
                />
                {tab.id === 'matches' && !!matchesBadge && matchesBadge > 0 && (
                  <Badge className="absolute -top-[7px] -right-[11px]">{matchesBadge}</Badge>
                )}
                {tab.id === 'likes' && !!likesBadge && likesBadge > 0 && (
                  <Badge className="absolute -top-[7px] -right-[11px]">{likesBadge}</Badge>
                )}
              </span>
            </span>
            <span className="text-[12px] font-medium">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
