import { ipcMain } from 'electron'
import { getDatabase } from './database'

export function registerIpcHandlers(): void {
  ipcMain.handle('db:getAllGenerations', () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM generations ORDER BY created_at DESC').all()
  })
}
