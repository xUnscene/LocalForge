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
}

contextBridge.exposeInMainWorld('localforge', api)

declare global {
  interface Window {
    localforge: typeof api
  }
}
