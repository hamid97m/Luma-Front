import { t } from '../i18n.js'

type Tab = 'discovery' | 'matches' | 'profile'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

const TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'discovery', icon: '🔥', label: t.nav.discovery },
  { id: 'matches',   icon: '💬', label: t.nav.matches   },
  { id: 'profile',   icon: '👤', label: t.nav.profile   },
]

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav
      className="glass-dark border-t border-white/10 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-all duration-200 ${
            active === tab.id ? 'opacity-100 scale-[1.08]' : 'opacity-40'
          }`}
        >
          <span className="text-2xl">{tab.icon}</span>
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
