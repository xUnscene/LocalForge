import { ChildProcess, spawn } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import { getEngineDir } from './engine-dir'

let sidecarProcess: ChildProcess | null = null
let sidecarPort: number | null = null

export type SidecarStatus = 'stopped' | 'starting' | 'running'

export function getSidecarPort(): number | null {
  return sidecarPort
}

export function getSidecarStatus(): SidecarStatus {
  if (!sidecarProcess) return 'stopped'
  if (sidecarPort === null) return 'starting'
  return 'running'
}

export function startSidecar(): Promise<number> {
  if (sidecarProcess !== null) {
    return sidecarPort !== null
      ? Promise.resolve(sidecarPort)
      : Promise.reject(new Error('Sidecar already starting'))
  }

  return new Promise((resolve, reject) => {
    const timeoutMs = 15_000
    let resolved = false

    // Windows-only path. Update to platform-conditional when macOS/Linux support is added.
    // Use the Windows Python Launcher ('py') in dev so it picks the highest installed Python 3.x,
    // avoiding the system 'python' alias which may point to an older version without dependencies.
    const scriptPath = join(app.getAppPath(), 'sidecar', 'main.py')
    const cmd = !app.isPackaged ? 'py' : join(process.resourcesPath, 'localforge-sidecar.exe')
    const args = !app.isPackaged ? [scriptPath] : []

    const { writeFileSync, appendFileSync } = require('fs')
    const logPath = join(app.getPath('userData'), 'sidecar.log')
    const engineDir = getEngineDir()
    writeFileSync(logPath, `[start] cmd=${cmd} args=${JSON.stringify(args)} engineDir=${engineDir}\n`)

    sidecarProcess = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, LOCALFORGE_ENGINE_DIR: engineDir },
    })

    sidecarProcess.stderr!.on('data', (data: Buffer) => {
      appendFileSync(logPath, `[stderr] ${data.toString()}`)
      console.error('[sidecar stderr]', data.toString())
    })

    sidecarProcess.stdout!.on('data', (data: Buffer) => {
      appendFileSync(logPath, `[stdout] ${data.toString()}`)
    })

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        reject(new Error(`Sidecar port timeout after ${timeoutMs}ms`))
      }
    }, timeoutMs)

    sidecarProcess.stdout!.on('data', (data: Buffer) => {
      const match = data.toString().match(/PORT=(\d+)/)
      if (match && !resolved) {
        resolved = true
        clearTimeout(timer)
        sidecarPort = parseInt(match[1], 10)
        resolve(sidecarPort)
      }
    })

    sidecarProcess.on('error', (err) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timer)
        reject(err)
      }
    })

    sidecarProcess.on('exit', (code) => {
      sidecarPort = null
      sidecarProcess = null
      if (!resolved) {
        resolved = true
        clearTimeout(timer)
        reject(new Error(`Sidecar exited with code ${code} before reporting port`))
      }
    })
  })
}

export function stopSidecar(): void {
  if (sidecarProcess) {
    sidecarProcess.kill('SIGTERM')
    sidecarProcess = null
    sidecarPort = null
  }
}
