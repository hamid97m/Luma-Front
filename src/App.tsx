import { useEffect, useState } from 'react'
import { api } from './api.js'
import { initTelegram, shouldPromptWriteAccessOnLaunch, useBackButton } from './telegram.js'
import { useAuthStore, usePremiumStore, useReferralStore } from './store.js'
import { cacheGender, isReturningUser, markReturningUser } from './utils/returningUser.js'
import { Splash } from './screens/Splash.js'
import { Reconnect } from './screens/Reconnect.js'
import { Blocked } from './screens/Blocked.js'
import { PhotoRequired } from './screens/PhotoRequired.js'
import { Onboarding } from './screens/Onboarding.js'
import { Discovery } from './screens/Discovery.js'
import { Likes } from './screens/Likes.js'
import { Matches } from './screens/Matches.js'
import { MyProfile } from './screens/MyProfile.js'
import { Chat } from './screens/Chat.js'
import { Support } from './screens/Support.js'
import { PaywallSheet } from './components/premium/PaywallSheet.js'
import { InviteSheet } from './components/referrals/InviteSheet.js'
import { BottomNav } from './components/BottomNav.js'
import { NotifyPrompt } from './components/NotifyPrompt.js'
import type { Match, UserProfile } from './types.js'

type Screen = 'splash' | 'onboarding' | 'main' | 'reconnect' | 'blocked' | 'photoRequired'
type Tab = 'discovery' | 'likes' | 'matches' | 'profile'

const TABS: readonly Tab[] = ['discovery', 'likes', 'matches', 'profile']

// Deep link: a bot message's webApp button opens the app at WEB_URL?screen=<tab>.
// Read it once at launch; only the four main tabs are valid targets.
function readDeepLinkTab(): Tab | null {
  try {
    const s = new URLSearchParams(window.location.search).get('screen')
    return s && (TABS as readonly string[]).includes(s) ? (s as Tab) : null
  } catch {
    return null
  }
}

// Deep link: a new-message notification button opens WEB_URL?screen=matches&chat=<matchId>.
// Read the match id once at launch so we can open that conversation directly.
function readDeepLinkChat(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('chat')
  } catch {
    return null
  }
}

// Deep link: WEB_URL?screen=plans opens the premium plans sheet on launch
// (used by broadcasts / bot buttons to send users straight to the paywall).
function readDeepLinkPlans(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('screen') === 'plans'
  } catch {
    return false
  }
}

export function App() {
  const initDataRaw = window.Telegram?.WebApp?.initData ?? null
  const { setUser, setInitDataRaw } = useAuthStore()
  const [screen, setScreen] = useState<Screen>('splash')
  const [splashDone, setSplashDone] = useState(false)
  const [authResult, setAuthResult] = useState<'onboarding' | 'main' | 'reconnect' | 'blocked' | 'photoRequired' | null>(null)
  const [tab, setTab] = useState<Tab>(() => readDeepLinkTab() ?? 'discovery')
  const [activeChatMatch, setActiveChatMatch] = useState<Match | null>(null)
  const [chatDeepLinkDone, setChatDeepLinkDone] = useState(false)
  // ?screen=plans → open the premium plans sheet once we reach the main app.
  const [plansOpen, setPlansOpen] = useState(() => readDeepLinkPlans())
  const [matchesRefreshKey, setMatchesRefreshKey] = useState(0)
  const [matchesBadge, setMatchesBadge] = useState(0)
  const [likesBadge, setLikesBadge] = useState(0)
  const [showNotifyPrompt, setShowNotifyPrompt] = useState(false)
  const [showSupport, setShowSupport] = useState(false)
  // Bot handle from the banned 401 — the Blocked screen deep-links there.
  const [supportBot, setSupportBot] = useState<string | null>(null)
  // Once a tab has been visited, keep it mounted (hidden via CSS) instead of
  // unmounting — avoids refetching and a loading flash on every tab switch.
  const [visited, setVisited] = useState<Record<Tab, boolean>>(() => {
    const d = readDeepLinkTab()
    return {
      discovery: true,
      likes: d === 'likes',
      matches: d === 'matches',
      profile: d === 'profile',
    }
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

  // Back-press closes the chat overlay. Sheets/Support push their own handler
  // on top of this via the shared back-button stack (see telegram.ts), so
  // whichever overlay is topmost gets the back-press.
  useBackButton(!!activeChatMatch, closeChat)

  useEffect(() => {
    if (screen !== 'main') return
    api.matches.unreadCount().then(({ count }) => setMatchesBadge(count))
    api.likes.unreadCount().then(({ count }) => setLikesBadge(count))
  }, [screen, matchesRefreshKey, tab])

  // Message-notification deep link: once in the app, resolve ?chat=<matchId> to
  // its Match and open the chat overlay. Runs once — guarded so returning from
  // the chat (which clears activeChatMatch) doesn't reopen it.
  useEffect(() => {
    if (screen !== 'main' || chatDeepLinkDone) return
    setChatDeepLinkDone(true)
    const chatId = readDeepLinkChat()
    if (!chatId) return
    api.matches.list()
      .then(({ matches }) => {
        const found = matches.find((m) => m.id === chatId)
        if (found) setActiveChatMatch(found)
      })
      .catch(() => {})
  }, [screen, chatDeepLinkDone])

  // Premium gate status (toggle + own expiry + plans) — needed before the
  // user first hits send in a gated chat; refreshed by the paywall on purchase.
  useEffect(() => {
    if (screen === 'main') usePremiumStore.getState().refresh()
  }, [screen])

  // Referral status (enabled flag + milestones) — drives the My Profile entry
  // card and the invite sheet's stepper.
  useEffect(() => {
    if (screen === 'main') useReferralStore.getState().refresh()
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
          const gender = (partial as Partial<UserProfile>).gender
          if (gender) cacheGender(gender)
          setUser(partial as UserProfile)
          setAuthResult(partial.paused ? 'photoRequired' : 'main')
        } else {
          setAuthResult('onboarding')
        }
      })
      .catch((err: unknown) => {
        const status = (err as { status?: number } | null)?.status
        const message = err instanceof Error ? err.message : ''
        if (status === 401 && message.includes('account_banned')) {
          try {
            setSupportBot((JSON.parse(message) as { botUsername?: string | null }).botUsername ?? null)
          } catch { /* older backend: plain-text body, no bot handle */ }
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
    return <Blocked supportBot={supportBot} />
  }

  if (screen === 'photoRequired') {
    return <PhotoRequired />
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
          cacheGender(p.gender)
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
      {/* ?screen=plans deep link — the plans sheet self-refreshes plans on open. */}
      <PaywallSheet open={plansOpen} onClose={() => setPlansOpen(false)} />
      <InviteSheet />
      {activeChatMatch && (
        <Chat
          key={activeChatMatch.id}
          match={activeChatMatch}
          myUserId={useAuthStore.getState().user!.id}
          onBack={closeChat}
        />
      )}
      <div
        className={`flex-col h-full bg-bg ${activeChatMatch ? 'hidden' : 'flex'}`}
        style={{ paddingTop: 'var(--tg-safe-top)' }}
      >
        <div className="flex-1 overflow-hidden">
          {visited.discovery && (
            <div className={`h-full ${tab === 'discovery' ? '' : 'hidden'}`}>
              <Discovery onOpenChat={setActiveChatMatch} />
            </div>
          )}
          {visited.likes && (
            <div className={`h-full ${tab === 'likes' ? '' : 'hidden'}`}>
              <Likes onOpenChat={setActiveChatMatch} />
            </div>
          )}
          {visited.matches && (
            <div className={`h-full ${tab === 'matches' ? '' : 'hidden'}`}>
              <Matches onOpenChat={setActiveChatMatch} onStartDiscovering={() => setTab('discovery')} refreshKey={matchesRefreshKey} />
            </div>
          )}
          {visited.profile && <div className={`h-full ${tab === 'profile' ? '' : 'hidden'}`}><MyProfile onOpenSupport={() => setShowSupport(true)} /></div>}
        </div>
        <BottomNav active={tab} onChange={setTab} matchesBadge={matchesBadge} likesBadge={likesBadge} />
        {showNotifyPrompt && <NotifyPrompt onDone={() => setShowNotifyPrompt(false)} />}
      </div>
    </>
  )
}
