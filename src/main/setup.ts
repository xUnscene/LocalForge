import { existsSync } from 'fs'
import { join } from 'path'

export function isSetupComplete(engineDir: string): boolean {
  return existsSync(join(engineDir, 'ComfyUI', 'main.py'))
}
