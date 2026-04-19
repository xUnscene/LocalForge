import { create } from 'zustand'

export interface ModelInfo {
  id: string
  name: string
  description: string
  vramRequiredGb: number
  downloadSizeGb: number
  installed: boolean
  sizeOnDiskGb: number | null
  badge: string
}

export type InstallStatus = 'idle' | 'downloading' | 'complete' | 'error'

interface ModelsState {
  models: ModelInfo[]
  installStatus: Record<string, InstallStatus>
  installProgress: Record<string, number>
  installError: Record<string, string | null>
  setModels: (models: ModelInfo[]) => void
  setInstallStatus: (id: string, status: InstallStatus, progress?: number, error?: string | null) => void
  markInstalled: (id: string) => void
  markRemoved: (id: string) => void
}

export const useModelsStore = create<ModelsState>((set) => ({
  models: [],
  installStatus: {},
  installProgress: {},
  installError: {},
  setModels: (models) => set({ models }),
  setInstallStatus: (id, status, progress = 0, error = null) =>
    set((state) => ({
      installStatus: { ...state.installStatus, [id]: status },
      installProgress: { ...state.installProgress, [id]: progress },
      installError: { ...state.installError, [id]: error },
    })),
  markInstalled: (id) =>
    set((state) => ({
      models: state.models.map((m) => m.id === id ? { ...m, installed: true } : m),
    })),
  markRemoved: (id) =>
    set((state) => ({
      models: state.models.map((m) =>
        m.id === id ? { ...m, installed: false, sizeOnDiskGb: null } : m
      ),
    })),
}))
