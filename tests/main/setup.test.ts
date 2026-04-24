import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { isSetupComplete } from '../../src/main/setup'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'localforge-setup-test-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true })
})

describe('isSetupComplete', () => {
  it('returns false when ComfyUI dir is missing', () => {
    expect(isSetupComplete(tmpDir)).toBe(false)
  })

  it('returns true when ComfyUI dir exists', () => {
    mkdirSync(join(tmpDir, 'ComfyUI'), { recursive: true })
    writeFileSync(join(tmpDir, 'ComfyUI', 'main.py'), '')
    expect(isSetupComplete(tmpDir)).toBe(true)
  })
})
