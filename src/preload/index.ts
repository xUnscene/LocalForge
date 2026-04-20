import { contextBridge, ipcRenderer } from 'electron'

export const api = {
  db: {
    getAllGenerations: () => ipcRenderer.invoke('db:getAllGenerations'),
  },
  sidecar: {
    getStatus: () => ipcRenderer.invoke('sidecar:getStatus'),
  },
  setup: {
    isComplete: () => ipcRenderer.invoke('setup:isComplete'),
  },
  generate: {
    saveRecord: (record: {
      id: string
      prompt: string
      seed: number
      model: string
      output_path: string
      thumbnail_path: string
      created_at: number
    }) => ipcRenderer.invoke('generate:saveRecord', record),
  },
  settings: {
    getOutputPath: () => ipcRenderer.invoke('settings:getOutputPath'),
    setOutputPath: (path: string) => ipcRenderer.invoke('settings:setOutputPath', path),
    browseOutputPath: (): Promise<string | null> => ipcRenderer.invoke('settings:browseOutputPath'),
  },
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
    openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  },
}

contextBridge.exposeInMainWorld('localforge', api)

declare global {
  interface Window {
    localforge: typeof api
  }
}
