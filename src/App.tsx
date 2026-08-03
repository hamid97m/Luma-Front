import { useEffect, useState } from 'react'
import { api } from './api.js'
import { useAuthStore } from './store.js'
import { isReturningUser, markReturningUser } from './utils/returningUser.js'
import { Splash } from './screens/Splash.js'
import { Reconnect } from './screens/Reconnect.js'
import { Onboarding } from './screens/Onboarding.js'
import { Discovery } from './screens/Discovery.js'
import { Matches } from './screens/Matches.js'
import { MyProfile } from './screens/MyProfile.js'
import { Chat } from './screens/Chat.js'
import { BottomNav } from './components/BottomNav.js'
import type { Match, UserProfile } from './types.js'

type Screen = 'splash' | 'onboarding' | 'main' | 'reconnect'
type Tab = 'discovery' | 'matches' | 'profile'

export function App() {
  const initDataRaw = window.Telegram?.WebApp?.initData ?? null
  const { setUser, setInitDataRaw } = useAuthStore()
  const [screen, setScreen] = useState<Screen>('splash')
  const [splashDone, setSplashDone] = useState(false)
  const [authResult, setAuthResult] = useState<'onboarding' | 'main' | 'reconnect' | null>(null)
  const [tab, setTab] = useState<Tab>('discovery')
  const [activeChatMatch, setActiveChatMatch] = useState<Match | null>(null)
  const [matchesRefreshKey, setMatchesRefreshKey] = useState(0)
  const [matchesBadge, setMatchesBadge] = useState(0)
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

  useEffect(() => {
    const backButton = window.Telegram?.WebApp?.BackButton
    if (!backButton) return
    if (!activeChatMatch) {
      backButton.hide()
      return
    }
    const handleClick = () => {
      setActiveChatMatch(null)
      setMatchesRefreshKey((k) => k + 1)
    }
    backButton.onClick(handleClick)
    backButton.show()
    return () => {
      backButton.offClick(handleClick)
      backButton.hide()
    }
  }, [activeChatMatch])

  useEffect(() => {
    if (screen !== 'main') return
    api.matches.unreadCount().then(({ count }) => setMatchesBadge(count))
  }, [screen, matchesRefreshKey])

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
      .then(({ user: partial }) => {
        if (partial.setupComplete) {
          markReturningUser()
          setUser(partial as UserProfile)
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

  if (activeChatMatch) {
    return (
      <Chat
        match={activeChatMatch}
        myUserId={useAuthStore.getState().user!.id}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#0b0b12]">
      <div className="flex-1 overflow-hidden">
        {visited.discovery && (
          <div className={`h-full ${tab === 'discovery' ? '' : 'hidden'}`}>
            <Discovery onOpenChat={setActiveChatMatch} />
          </div>
        )}
        {visited.matches && (
          <div className={`h-full ${tab === 'matches' ? '' : 'hidden'}`}>
            <Matches onOpenChat={setActiveChatMatch} refreshKey={matchesRefreshKey} />
          </div>
        )}
        {visited.profile && <div className={`h-full ${tab === 'profile' ? '' : 'hidden'}`}><MyProfile /></div>}
      </div>
      <BottomNav active={tab} onChange={setTab} matchesBadge={matchesBadge} />
    </div>
  )
}
