import { useEffect, useState } from 'react'
import { api } from './api.js'
import { initTelegram, shouldPromptWriteAccessOnLaunch } from './telegram.js'
import { useAuthStore, usePremiumStore } from './store.js'
import { isReturningUser, markReturningUser } from './utils/returningUser.js'
import { Splash } from './screens/Splash.js'
import { Reconnect } from './screens/Reconnect.js'
import { Blocked } from './screens/Blocked.js'
import { Onboarding } from './screens/Onboarding.js'
import { Discovery } from './screens/Discovery.js'
import { Matches } from './screens/Matches.js'
import { MyProfile } from './screens/MyProfile.js'
import { Chat } from './screens/Chat.js'
import { Support } from './screens/Support.js'
import { BottomNav } from './components/BottomNav.js'
import { NotifyPrompt } from './components/NotifyPrompt.js'
import type { Match, UserProfile } from './types.js'

type Screen = 'splash' | 'onboarding' | 'main' | 'reconnect' | 'blocked'
type Tab = 'discovery' | 'matches' | 'profile'

export function App() {
  const initDataRaw = window.Telegram?.WebApp?.initData ?? null
  const { setUser, setInitDataRaw } = useAuthStore()
  const [screen, setScreen] = useState<Screen>('splash')
  const [splashDone, setSplashDone] = useState(false)
  const [authResult, setAuthResult] = useState<'onboarding' | 'main' | 'reconnect' | 'blocked' | null>(null)
  const [tab, setTab] = useState<Tab>('discovery')
  const [activeChatMatch, setActiveChatMatch] = useState<Match | null>(null)
  const [matchesRefreshKey, setMatchesRefreshKey] = useState(0)
  const [matchesBadge, setMatchesBadge] = useState(0)
  const [showNotifyPrompt, setShowNotifyPrompt] = useState(false)
  const [showSupport, setShowSupport] = useState(false)
  // Once a tab has been visited, keep it mounted (hidden via CSS) instead of
  // unmounting — avoids refetching and a loading flash on every tab switch.
  const [visited, setVisited] = useState<Record<Tab, boolean>>({
    discovery: true,
    matches: false,
    profile: false,
  })

  // One-time Telegram setup: ready/expand, fullscreen, swipe-lock, safe-area vars.
  useEffect(() => { initTelegram() }, [])

  useEffect(() => {
    setVisited((v) => (v[tab] ? v : { ...v, [tab]: true }))
  }, [tab])

  // Shared back-to-matches handler — used by both the Telegram BackButton and
  // any in-chat action (e.g. after reporting) that needs to leave the chat.
  const closeChat = () => {
    setActiveChatMatch(null)
    setMatchesRefreshKey((k) => k + 1)
  }

  useEffect(() => {
    const backButton = window.Telegram?.WebApp?.BackButton
    if (!backButton) return
    if (showSupport) return            // Support overlay owns the back button while open
    if (!activeChatMatch) {
      backButton.hide()
      return
    }
    backButton.onClick(closeChat)
    backButton.show()
    return () => {
      backButton.offClick(closeChat)
      backButton.hide()
    }
  }, [activeChatMatch, showSupport])

  useEffect(() => {
    if (screen !== 'main') return
    api.matches.unreadCount().then(({ count }) => setMatchesBadge(count))
  }, [screen, matchesRefreshKey])

  // Premium gate status (toggle + own expiry + plans) — needed before the
  // user first hits send in a gated chat; refreshed by the paywall on purchase.
  useEffect(() => {
    if (screen === 'main') usePremiumStore.getState().refresh()
  }, [screen])

  // Ask for bot DM permission on entering the app — covers both a fresh
  // profile right after onboarding and returning users who never granted it.
  // Cooldown-gated so "Not now" isn't re-asked on every launch.
  useEffect(() => {
    if (screen === 'main') setShowNotifyPrompt(shouldPromptWriteAccessOnLaunch())
  }, [screen])

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
      .catch((err: unknown) => {
        const status = (err as { status?: number } | null)?.status
        const message = err instanceof Error ? err.message : ''
        if (status === 401 && message.includes('account_banned')) {
          setAuthResult('blocked')
          return
        }
        setAuthResult(isReturningUser() ? 'reconnect' : 'onboarding')
      })
  }, [initDataRaw])

  if (screen === 'splash') {
    return <Splash onDone={() => setSplashDone(true)} />
  }

  if (screen === 'blocked') {
    return <Blocked />
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

  // Chat renders alongside the main layout (hidden via CSS) instead of
  // replacing it, so the tabs stay mounted while chatting. Coming back shows
  // their content instantly; the back-button's refreshKey bump then refetches
  // matches silently instead of remounting into a loading screen.
  return (
    <>
      {showSupport && <Support onClose={() => setShowSupport(false)} />}
      {activeChatMatch && (
        <Chat
          key={activeChatMatch.id}
          match={activeChatMatch}
          myUserId={useAuthStore.getState().user!.id}
          onBack={closeChat}
        />
      )}
      <div
        className={`flex-col h-screen bg-bg ${activeChatMatch ? 'hidden' : 'flex'}`}
        style={{ paddingTop: 'var(--tg-safe-top)' }}
      >
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
          {visited.profile && <div className={`h-full ${tab === 'profile' ? '' : 'hidden'}`}><MyProfile onOpenSupport={() => setShowSupport(true)} /></div>}
        </div>
        <BottomNav active={tab} onChange={setTab} matchesBadge={matchesBadge} />
        {showNotifyPrompt && <NotifyPrompt onDone={() => setShowNotifyPrompt(false)} />}
      </div>
    </>
  )
}
