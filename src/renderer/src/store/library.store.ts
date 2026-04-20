import { create } from 'zustand'

export interface GenerationRecord {
  id: string
  prompt: string
  seed: number
  model: string
  output_path: string
  thumbnail_path: string
  created_at: number
}

interface LibraryState {
  generations: GenerationRecord[]
  selectedId: string | null
  setGenerations: (records: GenerationRecord[]) => void
  selectGeneration: (id: string | null) => void
}

export const useLibraryStore = create<LibraryState>((set) => ({
  generations: [],
  selectedId: null,
  setGenerations: (generations) => set({ generations }),
  selectGeneration: (selectedId) => set({ selectedId }),
}))
