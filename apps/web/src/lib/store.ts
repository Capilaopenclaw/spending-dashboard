import { create } from 'zustand'

interface AppState {
  language: 'sk' | 'en' | 'hu'
  setLanguage: (lang: 'sk' | 'en' | 'hu') => void
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  language: 'sk',
  setLanguage: (language) => set({ language }),
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}))
