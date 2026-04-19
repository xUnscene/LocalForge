import { existsSync } from 'fs'
import { join } from 'path'

export function isSetupComplete(userDataPath: string): boolean {
  return existsSync(join(userDataPath, 'engine', 'ComfyUI'))
}
