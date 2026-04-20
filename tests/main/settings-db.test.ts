import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { initDatabase, closeDatabase, getSettingValue, setSettingValue } from '../../src/main/database'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'localforge-test-'))
  initDatabase(join(tmpDir, 'test.db'))
})

afterEach(() => {
  closeDatabase()
  rmSync(tmpDir, { recursive: true })
})

describe('settings helpers', () => {
  it('getSettingValue returns null when key not set', () => {
    expect(getSettingValue('output_path')).toBeNull()
  })

  it('setSettingValue + getSettingValue round-trips a value', () => {
    setSettingValue('output_path', 'C:\\Users\\user\\outputs')
    expect(getSettingValue('output_path')).toBe('C:\\Users\\user\\outputs')
  })

  it('setSettingValue overwrites an existing value', () => {
    setSettingValue('output_path', 'C:\\old')
    setSettingValue('output_path', 'C:\\new')
    expect(getSettingValue('output_path')).toBe('C:\\new')
  })
})
