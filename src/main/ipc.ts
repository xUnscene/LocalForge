import { ipcMain } from 'electron'
import { app } from 'electron'
import { getDatabase } from './database'
import { getSidecarPort, getSidecarStatus } from './sidecar'
import { isSetupComplete } from './setup'

export function registerIpcHandlers(): void {
  ipcMain.handle('db:getAllGenerations', () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM generations ORDER BY created_at DESC').all()
  })

  ipcMain.handle('sidecar:getStatus', () => {
    return {
      status: getSidecarStatus(),
      port: getSidecarPort(),
    }
  })

  ipcMain.handle('setup:isComplete', () => {
    return isSetupComplete(app.getPath('userData'))
  })
}
