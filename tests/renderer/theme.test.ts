// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

describe('theme tokens', () => {
  it('defines required CSS custom properties', () => {
    const dir = fileURLToPath(new URL('.', import.meta.url))
    const css = readFileSync(resolve(dir, '../../src/renderer/src/styles/globals.css'), 'utf8')
    expect(css).toContain('--color-bg')
    expect(css).toContain('--color-surface')
    expect(css).toContain('--color-accent')
    expect(css).toContain('--color-text-primary')
    expect(css).toContain('--color-text-secondary')
  })
})
