import { ipcMain, app, dialog, shell } from 'electron'
import { join } from 'path'
import { copyFile, mkdir } from 'fs/promises'
import { basename } from 'path'
import { getDatabase, insertGeneration, GenerationRecord, getSettingValue, setSettingValue } from './database'
import { getSidecarPort, getSidecarStatus, stopSidecar, startSidecar } from './sidecar'
import { isSetupComplete } from './setup'
import { getEngineDir } from './engine-dir'

function getCheckpointsDir(): string {
  return join(getEngineDir(), 'ComfyUI', 'models', 'checkpoints')
}

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
    return isSetupComplete(getEngineDir())
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
    if (typeof path !== 'string' || !path.trim()) return
    setSettingValue('output_path', path)
  })

  ipcMain.handle('settings:browseOutputPath', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select output folder',
    })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('settings:getEngineDir', () => {
    return getEngineDir()
  })

  ipcMain.handle('settings:setEngineDir', async (_event, dir: string) => {
    if (typeof dir !== 'string' || !dir.trim()) return
    setSettingValue('engine_dir', dir.trim())
    stopSidecar()
    await startSidecar().catch((err) => console.error('Sidecar restart failed:', err))
  })

  ipcMain.handle('settings:browseEngineDir', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select engine/data folder',
    })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('models:openCheckpointsFolder', async () => {
    const dir = getCheckpointsDir()
    await mkdir(dir, { recursive: true })
    const err = await shell.openPath(dir)
    if (err) console.error('openCheckpointsFolder failed:', err, 'path:', dir)
  })

  ipcMain.handle('models:importLocal', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import model',
      filters: [{ name: 'Model files', extensions: ['safetensors', 'ckpt', 'pt', 'bin'] }],
      properties: ['openFile', 'multiSelections'],
    })
    if (canceled || filePaths.length === 0) return null

    const dir = getCheckpointsDir()
    await mkdir(dir, { recursive: true })

    const imported: string[] = []
    for (const src of filePaths) {
      const dest = join(dir, basename(src))
      await copyFile(src, dest)
      imported.push(basename(src))
    }
    return imported
  })

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  ipcMain.handle('app:openExternal', async (_event, url: string) => {
    let parsed: URL
    try { parsed = new URL(url) } catch { return }
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      await shell.openExternal(url)
    }
  })
}
