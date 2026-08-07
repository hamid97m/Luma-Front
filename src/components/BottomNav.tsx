import { t } from '../i18n.js'
import { haptic } from '../telegram.js'
import { Icon, Badge, type IconName } from './ui/index.js'

type Tab = 'discovery' | 'matches' | 'profile'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
  matchesBadge?: number
}

const TABS: Array<{ id: Tab; icon: IconName; label: string }> = [
  { id: 'discovery', icon: 'flame',   label: t.nav.discovery },
  { id: 'matches',   icon: 'message', label: t.nav.matches   },
  { id: 'profile',   icon: 'user',    label: t.nav.profile   },
]

export function BottomNav({ active, onChange, matchesBadge }: Props) {
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
              className={`w-16 h-8 rounded-m3-md flex items-center justify-center transition-colors ${
                isActive ? 'bg-primary-container' : 'bg-transparent'
              }`}
              style={isActive ? { animation: 'lumaNavPill .25s ease' } : undefined}
            >
              <span
                className="relative flex"
                style={isActive ? { animation: 'lumaNavPop .35s ease' } : undefined}
              >
                <Icon name={tab.icon} size={20} />
                {tab.id === 'matches' && !!matchesBadge && matchesBadge > 0 && (
                  <Badge className="absolute -top-[7px] -right-[11px]">{matchesBadge}</Badge>
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
