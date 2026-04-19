import { ipcMain } from 'electron'
import { app } from 'electron'
import { getDatabase, insertGeneration, GenerationRecord } from './database'
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

  ipcMain.handle('generate:saveRecord', (_event, record: GenerationRecord) => {
    if (!record || typeof record.id !== 'string' || !record.id ||
        typeof record.prompt !== 'string' || typeof record.seed !== 'number' ||
        typeof record.model !== 'string' || typeof record.output_path !== 'string') {
      return { success: false, error: 'Invalid record' }
    }
    insertGeneration(record)
    return { success: true }
  })
}
