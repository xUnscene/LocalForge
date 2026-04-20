import { create } from 'zustand'

export type ComfyStatus = 'running' | 'stopped' | 'starting' | 'error' | null

interface SettingsState {
  gpuName: string | null
  vramGb: number | null
  comfyStatus: ComfyStatus
  outputPath: string | null
  appVersion: string | null
  isRestarting: boolean
  setGpuInfo: (gpuName: string | null, vramGb: number | null) => void
  setComfyStatus: (status: ComfyStatus) => void
  setOutputPath: (path: string) => void
  setAppVersion: (version: string) => void
  setIsRestarting: (v: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  gpuName: null,
  vramGb: null,
  comfyStatus: null,
  outputPath: null,
  appVersion: null,
  isRestarting: false,
  setGpuInfo: (gpuName, vramGb) => set({ gpuName, vramGb }),
  setComfyStatus: (comfyStatus) => set({ comfyStatus }),
  setOutputPath: (outputPath) => set({ outputPath }),
  setAppVersion: (appVersion) => set({ appVersion }),
  setIsRestarting: (isRestarting) => set({ isRestarting }),
}))
