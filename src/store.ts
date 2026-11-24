import { create } from 'zustand'
import { api } from './api.js'
import type { MessageRequest, PremiumStatus, ReferralStatus, SentRequest, UserProfile } from './types.js'

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

interface ReferralState {
  status: ReferralStatus | null
  sheetOpen: boolean
  refresh: () => Promise<void>
  openSheet: () => void
  closeSheet: () => void
}

export const useReferralStore = create<ReferralState>()((set) => ({
  status: null,
  sheetOpen: false,
  // Swallow errors to keep the last known status (same as premium refresh).
  refresh: async () => {
    try {
      set({ status: await api.referrals.me() })
    } catch {
      /* keep last known */
    }
  },
  openSheet: () => set({ sheetOpen: true }),
  closeSheet: () => set({ sheetOpen: false }),
}))

interface RequestsState {
  received: MessageRequest[]
  sent: SentRequest[]
  loadReceived: () => Promise<void>
  loadSent: () => Promise<void>
  /** Drop a request I just decided on; a list fetched before that can't bring it back. */
  removeReceived: (id: string) => void
  reset: () => void
}

const decidedRequestIds = new Set<string>()
// Newest-call-wins: a slow older response must not overwrite a newer list.
let receivedSeq = 0
let sentSeq = 0

// Failures keep the last known lists (same as the other silent refreshes).
export const useRequestsStore = create<RequestsState>()((set) => ({
  received: [],
  sent: [],
  loadReceived: async () => {
    const seq = ++receivedSeq
    try {
      const { requests } = await api.requests.list()
      if (seq === receivedSeq) set({ received: requests.filter((r) => !decidedRequestIds.has(r.id)) })
    } catch { /* keep last known */ }
  },
  loadSent: async () => {
    const seq = ++sentSeq
    try {
      const { requests } = await api.requests.sent()
      if (seq === sentSeq) set({ sent: requests })
    } catch { /* keep last known */ }
  },
  removeReceived: (id) => {
    decidedRequestIds.add(id)
    set((s) => ({ received: s.received.filter((r) => r.id !== id) }))
  },
  reset: () => {
    receivedSeq++
    sentSeq++
    decidedRequestIds.clear()
    set({ received: [], sent: [] })
  },
}))
