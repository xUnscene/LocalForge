import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    exclude: ['**/node_modules/**', '**/.worktrees/**'],
    setupFiles: ['./tests/setup.ts'],
    environmentMatchGlobs: [
      ['tests/main/**', 'node'],
      ['tests/renderer/theme.test.ts', 'node'],
      ['tests/renderer/**', 'jsdom'],
    ],
  },
})
