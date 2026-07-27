import { create } from 'zustand'
import type { UserProfile } from './types.js'

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
