import { create } from 'zustand'

export type Screen = 'generate' | 'library' | 'models' | 'settings'

interface AppState {
  activeScreen: Screen
  navigate: (screen: Screen) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeScreen: 'generate',
  navigate: (screen) => set({ activeScreen: screen })
}))
