import { create } from 'zustand'
import { api } from './api.js'
import type { PremiumStatus, UserProfile } from './types.js'

interface AuthState {
  user: UserProfile | null
  initDataRaw: string
  setUser: (user: UserProfile) => void
  setInitDataRaw: (raw: string) => void
  clearUser: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initDataRaw: '',
  setUser: (user) => set({ user }),
  setInitDataRaw: (initDataRaw) => set({ initDataRaw }),
  clearUser: () => set({ user: null }),
}))

interface PremiumState {
  status: PremiumStatus | null
  refresh: () => Promise<void>
}

export const usePremiumStore = create<PremiumState>((set) => ({
  status: null,
  refresh: async () => {
    try {
      set({ status: await api.premium.status() })
    } catch {
      // keep the last known status — the server 403 is the enforcement anyway
    }
  },
}))
