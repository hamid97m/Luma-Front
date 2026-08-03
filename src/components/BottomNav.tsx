import { t } from '../i18n.js'
import { haptic } from '../telegram.js'

type Tab = 'discovery' | 'matches' | 'profile'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
  matchesBadge?: number
}

const TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'discovery', icon: '🔥', label: t.nav.discovery },
  { id: 'matches',   icon: '💬', label: t.nav.matches   },
  { id: 'profile',   icon: '👤', label: t.nav.profile   },
]

export function BottomNav({ active, onChange, matchesBadge }: Props) {
  return (
    <nav
      className="glass-dark border-t border-white/10 flex"
      style={{ paddingBottom: 'max(var(--tg-safe-bottom), env(safe-area-inset-bottom))' }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => {
            if (tab.id !== active) haptic.selection()
            onChange(tab.id)
          }}
          className={`relative flex-1 flex flex-col items-center py-3 gap-0.5 transition-all duration-200 ${
            active === tab.id ? 'opacity-100 scale-[1.08]' : 'opacity-40'
          }`}
        >
          <span className="text-2xl">{tab.icon}</span>
          {tab.id === 'matches' && !!matchesBadge && matchesBadge > 0 && (
            <span
              className="absolute top-1 right-[calc(50%-20px)] text-white text-[11px] font-extrabold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(90deg,#f43f5e,#ec4067)' }}
            >
              {matchesBadge}
            </span>
          )}
          <span
            className="text-[11px] font-bold"
            style={{ color: active === tab.id ? '#ec4067' : 'white' }}
          >
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  )
}
