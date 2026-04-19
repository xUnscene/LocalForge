import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Provide a default window.localforge stub so renderer tests don't error on IPC calls.
// Individual tests can override specific methods with vi.mocked(...).mockResolvedValue(...)
if (typeof window !== 'undefined') {
  vi.stubGlobal('localforge', {
    db: {
      getAllGenerations: vi.fn().mockResolvedValue([]),
    },
    sidecar: {
      getStatus: vi.fn().mockResolvedValue({ status: 'running', port: 8765 }),
    },
    setup: {
      isComplete: vi.fn().mockResolvedValue(true),
    },
  })
}
