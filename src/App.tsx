import { useEffect, useState } from 'react'
import { api } from './api.js'
import { useAuthStore } from './store.js'
import { Onboarding } from './screens/Onboarding.js'
import { ProfileSetup } from './screens/ProfileSetup.js'
import { Discovery } from './screens/Discovery.js'
import { Matches } from './screens/Matches.js'
import { MyProfile } from './screens/MyProfile.js'
import { BottomNav } from './components/BottomNav.js'

type Screen = 'loading' | 'onboarding' | 'setup' | 'main'
type Tab = 'discovery' | 'matches' | 'profile'

export function App() {
  // window.Telegram.WebApp.initData is set by Telegram in production
  // and by our browser mock in index.html for local dev
  const initDataRaw = window.Telegram?.WebApp?.initData ?? null
  const { user, setUser, setInitDataRaw } = useAuthStore()
  const [screen, setScreen] = useState<Screen>('loading')
  const [tab, setTab] = useState<Tab>('discovery')

  useEffect(() => {
    if (!initDataRaw) return
    setInitDataRaw(initDataRaw)
    window.Telegram?.WebApp?.expand?.()

    api.auth.verify(initDataRaw)
      .then(async ({ user: partialUser }) => {
        if (partialUser.setupComplete) {
          const fullProfile = await api.profile.get()
          setUser(fullProfile)
          setScreen('main')
        } else {
          setScreen('onboarding')
        }
      })
      .catch((err) => {
        console.error('auth error:', err)
        setScreen('onboarding')
      })
  }, [initDataRaw])

  if (screen === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-2xl">💘</div>
      </div>
    )
  }

  if (screen === 'onboarding') {
    return <Onboarding onStart={() => setScreen('setup')} />
  }

  if (screen === 'setup') {
    return (
      <ProfileSetup
        onComplete={async () => {
          const profile = await api.profile.get()
          setUser(profile)
          setScreen('main')
        }}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-hidden">
        {tab === 'discovery' && <Discovery />}
        {tab === 'matches' && <Matches />}
        {tab === 'profile' && <MyProfile />}
      </div>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
