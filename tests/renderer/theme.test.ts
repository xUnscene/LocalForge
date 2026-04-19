import { describe, it, expect } from 'vitest'

describe('theme tokens', () => {
  it('defines required CSS custom properties', () => {
    const fs = require('fs')
    const css = fs.readFileSync('src/renderer/src/styles/globals.css', 'utf8')
    expect(css).toContain('--color-bg')
    expect(css).toContain('--color-surface')
    expect(css).toContain('--color-accent')
    expect(css).toContain('--color-text-primary')
    expect(css).toContain('--color-text-secondary')
  })
})
