import '@testing-library/jest-dom'
import { vi } from 'vitest'

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
    generate: {
      saveRecord: vi.fn().mockResolvedValue({ success: true }),
    },
    settings: {
      getOutputPath: vi.fn().mockResolvedValue('C:\\LocalForge\\outputs'),
      setOutputPath: vi.fn().mockResolvedValue(undefined),
      browseOutputPath: vi.fn().mockResolvedValue(null),
    },
    app: {
      getVersion: vi.fn().mockResolvedValue('1.0.0'),
      openExternal: vi.fn().mockResolvedValue(undefined),
    },
  })
}
