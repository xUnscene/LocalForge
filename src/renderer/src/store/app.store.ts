import { create } from 'zustand'

export type Screen = 'generate' | 'library' | 'models' | 'settings'

interface AppState {
  activeScreen: Screen
  navigate: (screen: Screen) => void
  setupComplete: boolean | null
  setSetupComplete: (complete: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeScreen: 'generate',
  navigate: (screen) => set({ activeScreen: screen }),
  setupComplete: null,
  setSetupComplete: (complete) => set({ setupComplete: complete }),
}))
