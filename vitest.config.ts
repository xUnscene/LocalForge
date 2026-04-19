import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    environmentMatchGlobs: [
      ['tests/main/**', 'node'],
      ['tests/renderer/theme.test.ts', 'node'],
      ['tests/renderer/**', 'jsdom'],
    ],
  },
})
