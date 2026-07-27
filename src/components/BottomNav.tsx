import { t } from '../i18n.js'

type Tab = 'discovery' | 'matches' | 'profile'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

const TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'discovery', icon: '🔥', label: t.nav.discovery },
  { id: 'matches', icon: '💬', label: t.nav.matches },
  { id: 'profile', icon: '👤', label: t.nav.profile },
]

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="flex border-t bg-white" style={{ background: 'var(--tg-theme-bg-color)' }}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors ${
            active === tab.id ? 'opacity-100' : 'opacity-40'
          }`}
          style={active === tab.id ? { color: 'var(--tg-theme-button-color)' } : {}}
        >
          <span className="text-xl">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
