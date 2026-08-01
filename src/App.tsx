import { useEffect, useState } from 'react'
import { api } from './api.js'
import { useAuthStore } from './store.js'
import { Splash } from './screens/Splash.js'
import { Reconnect } from './screens/Reconnect.js'
import { Onboarding } from './screens/Onboarding.js'
import { Discovery } from './screens/Discovery.js'
import { Matches } from './screens/Matches.js'
import { MyProfile } from './screens/MyProfile.js'
import { BottomNav } from './components/BottomNav.js'

type Screen = 'splash' | 'onboarding' | 'main' | 'reconnect'
type Tab = 'discovery' | 'matches' | 'profile'

// Once a Telegram ID has completed setup, never send it through onboarding
// again — a later 401/network failure (e.g. stale initData) should show a
// retry screen instead, not the signup flow.
const RETURNING_USER_KEY = 'luma_setup_complete_tg_id'

function isReturningUser(): boolean {
  const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id
  return tgId != null && localStorage.getItem(RETURNING_USER_KEY) === String(tgId)
}

function markReturningUser(): void {
  const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id
  if (tgId != null) localStorage.setItem(RETURNING_USER_KEY, String(tgId))
}

export function App() {
  const initDataRaw = window.Telegram?.WebApp?.initData ?? null
  const { setUser, setInitDataRaw } = useAuthStore()
  const [screen, setScreen] = useState<Screen>('splash')
  const [splashDone, setSplashDone] = useState(false)
  const [authResult, setAuthResult] = useState<'onboarding' | 'main' | 'reconnect' | null>(null)
  const [tab, setTab] = useState<Tab>('discovery')
  // Once a tab has been visited, keep it mounted (hidden via CSS) instead of
  // unmounting — avoids refetching and a loading flash on every tab switch.
  const [visited, setVisited] = useState<Record<Tab, boolean>>({
    discovery: true,
    matches: false,
    profile: false,
  })

  useEffect(() => {
    setVisited((v) => (v[tab] ? v : { ...v, [tab]: true }))
  }, [tab])

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
          markReturningUser()
          const full = await api.profile.get()
          setUser(full)
          setAuthResult('main')
        } else {
          setAuthResult('onboarding')
        }
      })
      .catch(() => setAuthResult(isReturningUser() ? 'reconnect' : 'onboarding'))
  }, [initDataRaw])

  if (screen === 'splash') {
    return <Splash onDone={() => setSplashDone(true)} />
  }

  if (screen === 'reconnect') {
    return <Reconnect onRetry={() => window.location.reload()} />
  }

  if (screen === 'onboarding') {
    return (
      <Onboarding
        onComplete={async () => {
          markReturningUser()
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
        {visited.discovery && <div className={`h-full ${tab === 'discovery' ? '' : 'hidden'}`}><Discovery /></div>}
        {visited.matches && <div className={`h-full ${tab === 'matches' ? '' : 'hidden'}`}><Matches /></div>}
        {visited.profile && <div className={`h-full ${tab === 'profile' ? '' : 'hidden'}`}><MyProfile /></div>}
      </div>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
