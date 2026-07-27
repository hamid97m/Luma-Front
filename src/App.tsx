import { useEffect, useState } from 'react'
import { useRawInitData } from '@telegram-apps/sdk-react'
import { api } from './api.js'
import { useAuthStore } from './store.js'
import { Onboarding } from './screens/Onboarding.js'
import { ProfileSetup } from './screens/ProfileSetup.js'

type Screen = 'loading' | 'onboarding' | 'setup' | 'main'

export function App() {
  const initDataRaw = useRawInitData()
  const { user, setUser, setInitDataRaw } = useAuthStore()
  const [screen, setScreen] = useState<Screen>('loading')

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
      .catch(() => setScreen('onboarding'))
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

  // 'main' screen added in Task 14
  return <div className="flex items-center justify-center h-screen">در حال ساخت...</div>
}
