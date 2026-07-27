import { create } from 'zustand';
export const useAuthStore = create((set) => ({
    user: null,
    initDataRaw: '',
    setUser: (user) => set({ user }),
    setInitDataRaw: (initDataRaw) => set({ initDataRaw }),
    clearUser: () => set({ user: null }),
}));
