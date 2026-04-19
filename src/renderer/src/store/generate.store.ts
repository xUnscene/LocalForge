import { create } from 'zustand'

export interface ShotSettings {
  camera: string
  lens: string
  lighting: string
  ratio: string
}

export type GenerationStatus = 'idle' | 'queued' | 'generating' | 'complete' | 'error'

interface GenerateState {
  subject: string
  style: string
  shot: ShotSettings
  status: GenerationStatus
  progress: number
  seed: number | null
  outputImagePath: string | null
  lastError: string | null
  setSubject: (s: string) => void
  setStyle: (s: string) => void
  setShotField: (field: keyof ShotSettings, value: string) => void
  setGenerationResult: (result: Partial<Pick<GenerateState, 'status' | 'progress' | 'seed' | 'outputImagePath' | 'lastError'>>) => void
  resetGeneration: () => void
}

export const useGenerateStore = create<GenerateState>((set) => ({
  subject: '',
  style: 'cinematic',
  shot: { camera: 'Sony A7 IV', lens: '35mm f/1.4', lighting: 'Natural', ratio: '16:9' },
  status: 'idle',
  progress: 0,
  seed: null,
  outputImagePath: null,
  lastError: null,
  setSubject: (s) => set({ subject: s }),
  setStyle: (s) => set({ style: s }),
  setShotField: (field, value) => set((state) => ({ shot: { ...state.shot, [field]: value } })),
  setGenerationResult: (result) => set((state) => ({ ...state, ...result })),
  resetGeneration: () => set({ status: 'idle', progress: 0, seed: null, outputImagePath: null, lastError: null }),
}))
