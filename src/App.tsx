import { useEffect, useState } from 'react'
import { api } from './api.js'
import { useAuthStore } from './store.js'
import { Splash } from './screens/Splash.js'
import { Onboarding } from './screens/Onboarding.js'
import { Discovery } from './screens/Discovery.js'
import { Matches } from './screens/Matches.js'
import { MyProfile } from './screens/MyProfile.js'
import { BottomNav } from './components/BottomNav.js'

type Screen = 'splash' | 'onboarding' | 'main'
type Tab = 'discovery' | 'matches' | 'profile'

export function App() {
  const initDataRaw = window.Telegram?.WebApp?.initData ?? null
  const { setUser, setInitDataRaw } = useAuthStore()
  const [screen, setScreen] = useState<Screen>('splash')
  const [splashDone, setSplashDone] = useState(false)
  const [authResult, setAuthResult] = useState<'onboarding' | 'main' | null>(null)
  const [tab, setTab] = useState<Tab>('discovery')

  // Advance only when both the splash timer has fired and auth has resolved
  useEffect(() => {
    if (splashDone && authResult) setScreen(authResult)
  }, [splashDone, authResult])

  useEffect(() => {
    if (!initDataRaw) {
      // Dev / no-Telegram context — skip auth, show onboarding
      setAuthResult('onboarding')
      return
    }
    setInitDataRaw(initDataRaw)
    window.Telegram?.WebApp?.expand?.()

    api.auth.verify(initDataRaw)
      .then(async ({ user: partial }) => {
        if (partial.setupComplete) {
          const full = await api.profile.get()
          setUser(full)
          setAuthResult('main')
        } else {
          setAuthResult('onboarding')
        }
      })
      .catch(() => setAuthResult('onboarding'))
  }, [initDataRaw])

  if (screen === 'splash') {
    return <Splash onDone={() => setSplashDone(true)} />
  }

  if (screen === 'onboarding') {
    return (
      <Onboarding
        onComplete={async () => {
          const p = await api.profile.get()
          setUser(p)
          setScreen('main')
        }}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#0b0b12]">
      <div className="flex-1 overflow-hidden">
        {tab === 'discovery' && <Discovery />}
        {tab === 'matches' && <Matches />}
        {tab === 'profile' && <MyProfile />}
      </div>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
