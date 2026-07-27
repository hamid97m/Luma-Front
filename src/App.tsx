import { useEffect, useState } from 'react'
import { useRawInitData } from '@telegram-apps/sdk-react'
import { api } from './api.js'
import { useAuthStore } from './store.js'

type Screen = 'loading' | 'onboarding' | 'setup' | 'main'

export function App() {
  const initDataRaw = useRawInitData()
  const { setUser, setInitDataRaw } = useAuthStore()
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

  // Screens plugged in by subsequent tasks
  return <div>در حال ساخت...</div>
}
