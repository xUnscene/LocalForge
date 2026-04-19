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
}

contextBridge.exposeInMainWorld('localforge', api)

declare global {
  interface Window {
    localforge: typeof api
  }
}
