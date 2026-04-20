import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pkg = require('../../package.json')

describe('package.json build scripts', () => {
  it('has build:sidecar script', () => {
    expect(pkg.scripts['build:sidecar']).toBeDefined()
    expect(pkg.scripts['build:sidecar']).toContain('pyinstaller')
  })

  it('has dist:win script', () => {
    expect(pkg.scripts['dist:win']).toBeDefined()
    expect(pkg.scripts['dist:win']).toContain('electron-builder')
  })

  it('has build:release script that chains build and dist', () => {
    expect(pkg.scripts['build:release']).toBeDefined()
    expect(pkg.scripts['build:release']).toContain('build:sidecar')
    expect(pkg.scripts['build:release']).toContain('dist:win')
  })
})
