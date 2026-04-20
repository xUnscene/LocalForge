import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const config = require('../../electron-builder.config.js')

describe('electron-builder config', () => {
  it('has required app identity fields', () => {
    expect(config.appId).toBe('com.localforge.app')
    expect(config.productName).toBe('LocalForge')
  })

  it('targets Windows NSIS x64', () => {
    expect(config.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }])
  })

  it('includes sidecar exe as extra resource', () => {
    const sidecar = config.extraResources.find(
      (r: { from: string; to: string }) => r.to === 'localforge-sidecar.exe'
    )
    expect(sidecar).toBeDefined()
    expect(sidecar!.from).toBe('sidecar/dist/localforge-sidecar.exe')
  })

  it('files filter includes out/ and excludes source maps', () => {
    expect(config.files).toContain('out/**')
    expect(config.files).toContain('!out/**/*.map')
  })

  it('NSIS installer creates shortcuts and allows directory selection', () => {
    expect(config.nsis.oneClick).toBe(false)
    expect(config.nsis.allowToChangeInstallationDirectory).toBe(true)
    expect(config.nsis.createDesktopShortcut).toBe(true)
    expect(config.nsis.createStartMenuShortcut).toBe(true)
  })
})
