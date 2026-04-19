import { ChildProcess, spawn } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'

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
  return new Promise((resolve, reject) => {
    const timeoutMs = 15_000
    let resolved = false

    const cmd = is.dev ? 'python' : join(process.resourcesPath, 'localforge-sidecar.exe')
    const args = is.dev ? [join(app.getAppPath(), 'sidecar', 'main.py')] : []

    sidecarProcess = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    sidecarProcess.stdout!.on('data', (data: Buffer) => {
      const match = data.toString().match(/PORT=(\d+)/)
      if (match && !resolved) {
        resolved = true
        sidecarPort = parseInt(match[1], 10)
        resolve(sidecarPort)
      }
    })

    sidecarProcess.on('error', (err) => {
      if (!resolved) { resolved = true; reject(err) }
    })

    sidecarProcess.on('exit', (code) => {
      sidecarPort = null
      if (!resolved) {
        resolved = true
        reject(new Error(`Sidecar exited with code ${code} before reporting port`))
      }
    })

    setTimeout(() => {
      if (!resolved) {
        resolved = true
        reject(new Error(`Sidecar port timeout after ${timeoutMs}ms`))
      }
    }, timeoutMs)
  })
}

export function stopSidecar(): void {
  if (sidecarProcess) {
    sidecarProcess.kill('SIGTERM')
    sidecarProcess = null
    sidecarPort = null
  }
}
