import { ipcMain, app, dialog, shell } from 'electron'
import { join } from 'path'
import { getDatabase, insertGeneration, GenerationRecord, getSettingValue, setSettingValue } from './database'
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

  ipcMain.handle('settings:getOutputPath', () => {
    return getSettingValue('output_path') ?? join(app.getPath('userData'), 'outputs')
  })

  ipcMain.handle('settings:setOutputPath', (_event, path: string) => {
    setSettingValue('output_path', path)
  })

  ipcMain.handle('settings:browseOutputPath', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select output folder',
    })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  ipcMain.handle('app:openExternal', (_event, url: string) => {
    shell.openExternal(url)
  })
}
