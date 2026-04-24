import { app } from 'electron'
import { join } from 'path'
import { getSettingValue } from './database'

export function getEngineDir(): string {
  try {
    const stored = getSettingValue('engine_dir')
    const result = stored ?? join(app.getPath('userData'), 'engine')
    return result
  } catch (e) {
    return join(app.getPath('userData'), 'engine')
  }
}
