# LocalForge Plan 7: Settings Screen

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A functional Settings screen showing detected GPU + VRAM, ComfyUI engine status with a restart button, a configurable output folder path, and app version with a "Check for updates" link.

**Architecture:** Settings data comes from three sources — the Python sidecar (GPU info via `GET /setup/gpu-info`, ComfyUI status via `GET /engine/status`), the SQLite `settings` table (output folder path), and Electron's `app.getVersion()`. A new `useSettingsStore` Zustand store holds all in-memory state. The Settings screen loads everything on mount via `useEffect` and exposes actions (restart engine, browse folder). IPC and preload layers are extended with `settings` and `app` namespaces. No sidecar changes needed — all required endpoints (`/setup/gpu-info`, `/engine/status`, `/engine/stop`, `/engine/start`) already exist from Plans 2 and 3.

**Tech Stack:** React useState/useEffect | Zustand | fetch (sidecar REST) | Electron IPC (dialog, shell, app) | better-sqlite3

---

## File Map

```
src/
├── main/
│   ├── database.ts          MODIFY: add settings table + getSettingValue/setSettingValue helpers
│   └── ipc.ts               MODIFY: add settings:* and app:* IPC handlers
├── preload/
│   └── index.ts             MODIFY: expose window.localforge.settings + window.localforge.app
└── renderer/src/
    ├── store/
    │   └── settings.store.ts  NEW: gpuName, vramGb, comfyStatus, outputPath, appVersion, isRestarting
    └── screens/
        └── Settings.tsx       MODIFY: replace stub with full implementation

tests/
├── setup.ts                   MODIFY: add settings + app stubs to window.localforge
├── main/
│   └── settings-db.test.ts    NEW: 3 tests for database helpers
└── renderer/
    ├── settings.store.test.ts  NEW: 3 tests
    └── Settings.test.tsx       NEW: 4 tests
```

---

### Task 1: Settings Persistence Layer

**Files:**
- Modify: `src/main/database.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/preload/index.ts`
- Modify: `tests/setup.ts`
- Create: `tests/main/settings-db.test.ts`

- [ ] **Step 1: Write the failing test at `tests/main/settings-db.test.ts`**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\\Program Files\\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\\AI\\Projects\\SimpliGen\\.worktrees\\plan-7-settings'; & 'C:\\Program Files\\nodejs\\npm.cmd' run test -- tests/main/settings-db.test.ts"
```

Expected: FAIL — `getSettingValue` not exported from database

- [ ] **Step 3: Add settings table + helpers to `src/main/database.ts`**

Add the settings table creation inside `initDatabase`, after the existing `generations` table `exec`:

```typescript
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)
```

Add these two exported functions at the bottom of the file:

```typescript
export function getSettingValue(key: string): string | null {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSettingValue(key: string, value: string): void {
  const db = getDatabase()
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}
```

- [ ] **Step 4: Run test to verify it passes**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\\Program Files\\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\\AI\\Projects\\SimpliGen\\.worktrees\\plan-7-settings'; & 'C:\\Program Files\\nodejs\\npm.cmd' run test -- tests/main/settings-db.test.ts"
```

Expected: PASS (3 tests)

- [ ] **Step 5: Add IPC handlers to `src/main/ipc.ts`**

Add to the imports at the top:

```typescript
import { app, dialog, shell } from 'electron'
import { join } from 'path'
import { getSettingValue, setSettingValue } from './database'
```

Note: `ipcMain` and `app` are already imported — replace the existing `import { ipcMain } from 'electron'` and `import { app } from 'electron'` lines with the combined import above.

Add these four handlers inside `registerIpcHandlers()`, after the existing handlers:

```typescript
  ipcMain.handle('settings:getOutputPath', () => {
    return getSettingValue('output_path') ?? join(app.getPath('userData'), 'outputs')
  })

  ipcMain.handle('settings:setOutputPath', (_event, path: string) => {
    setSettingValue('output_path', path)
  })

  ipcMain.handle('settings:browseOutputPath', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select output folder',
    })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  ipcMain.handle('app:openExternal', (_event, url: string) => {
    shell.openExternal(url)
  })
```

- [ ] **Step 6: Extend `src/preload/index.ts`**

Replace the entire file with:

```typescript
import { contextBridge, ipcRenderer } from 'electron'

export const api = {
  db: {
    getAllGenerations: () => ipcRenderer.invoke('db:getAllGenerations'),
  },
  sidecar: {
    getStatus: () => ipcRenderer.invoke('sidecar:getStatus'),
  },
  setup: {
    isComplete: () => ipcRenderer.invoke('setup:isComplete'),
  },
  generate: {
    saveRecord: (record: {
      id: string
      prompt: string
      seed: number
      model: string
      output_path: string
      thumbnail_path: string
      created_at: number
    }) => ipcRenderer.invoke('generate:saveRecord', record),
  },
  settings: {
    getOutputPath: () => ipcRenderer.invoke('settings:getOutputPath'),
    setOutputPath: (path: string) => ipcRenderer.invoke('settings:setOutputPath', path),
    browseOutputPath: (): Promise<string | null> => ipcRenderer.invoke('settings:browseOutputPath'),
  },
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
    openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  },
}

contextBridge.exposeInMainWorld('localforge', api)

declare global {
  interface Window {
    localforge: typeof api
  }
}
```

- [ ] **Step 7: Update `tests/setup.ts` to add stubs for settings and app**

Replace the entire file with:

```typescript
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
```

- [ ] **Step 8: Run all tests to confirm no regressions**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\\Program Files\\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\\AI\\Projects\\SimpliGen\\.worktrees\\plan-7-settings'; & 'C:\\Program Files\\nodejs\\npm.cmd' run test"
```

Expected: 49 passes (46 existing + 3 new settings-db tests)

- [ ] **Step 9: Commit**

```bash
git -C "f:/AI/Projects/SimpliGen/.worktrees/plan-7-settings" add src/main/database.ts src/main/ipc.ts src/preload/index.ts tests/setup.ts tests/main/settings-db.test.ts
git -C "f:/AI/Projects/SimpliGen/.worktrees/plan-7-settings" commit -m "feat: add settings persistence layer (DB helpers, IPC handlers, preload bridge)"
```

---

### Task 2: Settings Zustand Store

**Files:**
- Create: `src/renderer/src/store/settings.store.ts`
- Create: `tests/renderer/settings.store.test.ts`

- [ ] **Step 1: Write the failing test at `tests/renderer/settings.store.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from '../../src/renderer/src/store/settings.store'

describe('SettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      gpuName: null,
      vramGb: null,
      comfyStatus: null,
      outputPath: null,
      appVersion: null,
      isRestarting: false,
    })
  })

  it('setGpuInfo updates gpuName and vramGb', () => {
    useSettingsStore.getState().setGpuInfo('NVIDIA RTX 4090', 24)
    expect(useSettingsStore.getState().gpuName).toBe('NVIDIA RTX 4090')
    expect(useSettingsStore.getState().vramGb).toBe(24)
  })

  it('setComfyStatus updates comfyStatus', () => {
    useSettingsStore.getState().setComfyStatus('running')
    expect(useSettingsStore.getState().comfyStatus).toBe('running')
  })

  it('setOutputPath updates outputPath', () => {
    useSettingsStore.getState().setOutputPath('C:\\outputs')
    expect(useSettingsStore.getState().outputPath).toBe('C:\\outputs')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\\Program Files\\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\\AI\\Projects\\SimpliGen\\.worktrees\\plan-7-settings'; & 'C:\\Program Files\\nodejs\\npm.cmd' run test -- tests/renderer/settings.store.test.ts"
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `src/renderer/src/store/settings.store.ts`**

```typescript
import { create } from 'zustand'

export type ComfyStatus = 'running' | 'stopped' | 'starting' | 'error' | null

interface SettingsState {
  gpuName: string | null
  vramGb: number | null
  comfyStatus: ComfyStatus
  outputPath: string | null
  appVersion: string | null
  isRestarting: boolean
  setGpuInfo: (gpuName: string | null, vramGb: number | null) => void
  setComfyStatus: (status: ComfyStatus) => void
  setOutputPath: (path: string) => void
  setAppVersion: (version: string) => void
  setIsRestarting: (v: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  gpuName: null,
  vramGb: null,
  comfyStatus: null,
  outputPath: null,
  appVersion: null,
  isRestarting: false,
  setGpuInfo: (gpuName, vramGb) => set({ gpuName, vramGb }),
  setComfyStatus: (comfyStatus) => set({ comfyStatus }),
  setOutputPath: (outputPath) => set({ outputPath }),
  setAppVersion: (appVersion) => set({ appVersion }),
  setIsRestarting: (isRestarting) => set({ isRestarting }),
}))
```

- [ ] **Step 4: Run test to verify it passes**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\\Program Files\\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\\AI\\Projects\\SimpliGen\\.worktrees\\plan-7-settings'; & 'C:\\Program Files\\nodejs\\npm.cmd' run test -- tests/renderer/settings.store.test.ts"
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git -C "f:/AI/Projects/SimpliGen/.worktrees/plan-7-settings" add src/renderer/src/store/settings.store.ts tests/renderer/settings.store.test.ts
git -C "f:/AI/Projects/SimpliGen/.worktrees/plan-7-settings" commit -m "feat: add settings Zustand store (gpuName, vramGb, comfyStatus, outputPath, appVersion)"
```

---

### Task 3: Settings Screen

**Files:**
- Modify: `src/renderer/src/screens/Settings.tsx` (replace stub)
- Create: `tests/renderer/Settings.test.tsx`

- [ ] **Step 1: Write the failing test at `tests/renderer/Settings.test.tsx`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Settings } from '../../src/renderer/src/screens/Settings'
import { useSettingsStore } from '../../src/renderer/src/store/settings.store'

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({
      gpuName: null,
      vramGb: null,
      comfyStatus: null,
      outputPath: null,
      appVersion: null,
      isRestarting: false,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'stopped', detected: false }),
    }))
  })

  it('renders screen-settings testid', () => {
    render(<Settings />)
    expect(screen.getByTestId('screen-settings')).toBeInTheDocument()
  })

  it('displays GPU name when store has gpu info', () => {
    useSettingsStore.setState({ gpuName: 'NVIDIA RTX 4090', vramGb: 24 })
    render(<Settings />)
    expect(screen.getByText('NVIDIA RTX 4090')).toBeInTheDocument()
    expect(screen.getByText(/24 GB/i)).toBeInTheDocument()
  })

  it('displays ComfyUI status when store has status', () => {
    useSettingsStore.setState({ comfyStatus: 'running' })
    render(<Settings />)
    expect(screen.getByText(/running/i)).toBeInTheDocument()
  })

  it('clicking Restart Engine button fetches engine stop then start', async () => {
    useSettingsStore.setState({ comfyStatus: 'running' })
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'running' }),
    })
    vi.stubGlobal('fetch', mockFetch)
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: /restart engine/i }))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8765/engine/stop',
        expect.objectContaining({ method: 'POST' })
      )
    })
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8765/engine/start',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\\Program Files\\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\\AI\\Projects\\SimpliGen\\.worktrees\\plan-7-settings'; & 'C:\\Program Files\\nodejs\\npm.cmd' run test -- tests/renderer/Settings.test.tsx"
```

Expected: some tests fail (stub doesn't show GPU name, ComfyUI status, or respond to restart)

- [ ] **Step 3: Read the existing `src/renderer/src/screens/Settings.tsx` stub, then replace it entirely**

```tsx
import { useEffect } from 'react'
import { useSettingsStore, ComfyStatus } from '../store/settings.store'

export function Settings() {
  const {
    gpuName, vramGb, comfyStatus, outputPath, appVersion, isRestarting,
    setGpuInfo, setComfyStatus, setOutputPath, setAppVersion, setIsRestarting,
  } = useSettingsStore()

  useEffect(() => {
    async function load() {
      const version = await window.localforge.app.getVersion()
      setAppVersion(version)

      const path = await window.localforge.settings.getOutputPath()
      setOutputPath(path)

      const { port } = await window.localforge.sidecar.getStatus()
      if (!port) return

      fetch(`http://127.0.0.1:${port}/setup/gpu-info`)
        .then((r) => r.json())
        .then((data) => {
          if (data.detected) setGpuInfo(data.name, data.vram_gb)
          else setGpuInfo('No GPU detected', null)
        })
        .catch(() => setGpuInfo('Detection failed', null))

      fetch(`http://127.0.0.1:${port}/engine/status`)
        .then((r) => r.json())
        .then((data) => setComfyStatus(data.status as ComfyStatus))
        .catch(() => setComfyStatus('error'))
    }
    load()
  }, [setGpuInfo, setComfyStatus, setOutputPath, setAppVersion])

  const handleRestart = async () => {
    const { port } = await window.localforge.sidecar.getStatus()
    if (!port) return
    setIsRestarting(true)
    try {
      await fetch(`http://127.0.0.1:${port}/engine/stop`, { method: 'POST' })
      await fetch(`http://127.0.0.1:${port}/engine/start`, { method: 'POST' })
      const res = await fetch(`http://127.0.0.1:${port}/engine/status`)
      const data = await res.json()
      setComfyStatus(data.status as ComfyStatus)
    } finally {
      setIsRestarting(false)
    }
  }

  const handleBrowse = async () => {
    const selected = await window.localforge.settings.browseOutputPath()
    if (selected) {
      await window.localforge.settings.setOutputPath(selected)
      setOutputPath(selected)
    }
  }

  const statusColor =
    comfyStatus === 'running' ? '#4ade80'
    : comfyStatus === 'error' ? '#f87171'
    : 'var(--color-text-secondary)'

  const section: React.CSSProperties = { marginBottom: 28 }
  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
  }
  const card: React.CSSProperties = {
    background: 'var(--color-surface)', borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)', padding: 16,
  }
  const fieldLabel: React.CSSProperties = {
    fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4,
  }
  const fieldValue: React.CSSProperties = {
    fontSize: 15, color: 'var(--color-text-primary)', fontWeight: 500,
  }
  const secondaryBtn: React.CSSProperties = {
    fontSize: 13, color: 'var(--color-text-primary)',
    background: 'var(--color-surface-raised)', padding: '8px 16px',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
  }

  return (
    <div data-testid="screen-settings" style={{ flex: 1, padding: 24, overflow: 'auto', maxWidth: 640 }}>
      <h1 style={{ color: 'var(--color-text-secondary)', fontWeight: 300, marginBottom: 32 }}>Settings</h1>

      {/* Hardware */}
      <section style={section}>
        <div style={sectionLabel}>Hardware</div>
        <div style={card}>
          <div style={fieldLabel}>GPU</div>
          <div style={fieldValue}>{gpuName ?? '—'}</div>
          {vramGb !== null && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              {vramGb} GB VRAM
            </div>
          )}
        </div>
      </section>

      {/* Engine */}
      <section style={section}>
        <div style={sectionLabel}>Engine</div>
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={fieldLabel}>ComfyUI</div>
            <div style={{ ...fieldValue, color: statusColor, textTransform: 'capitalize' }}>
              {comfyStatus ?? '—'}
            </div>
          </div>
          <button
            onClick={handleRestart}
            disabled={isRestarting}
            style={{ ...secondaryBtn, cursor: isRestarting ? 'not-allowed' : 'pointer', opacity: isRestarting ? 0.5 : 1 }}
          >
            {isRestarting ? 'Restarting…' : 'Restart Engine'}
          </button>
        </div>
      </section>

      {/* Output folder */}
      <section style={section}>
        <div style={sectionLabel}>Output</div>
        <div style={card}>
          <div style={{ ...fieldLabel, marginBottom: 8 }}>Output Folder</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              flex: 1, fontSize: 12, color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)', background: 'var(--color-bg)',
              padding: '8px 10px', borderRadius: 'var(--radius)',
              border: '1px solid var(--color-border)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {outputPath ?? '—'}
            </div>
            <button onClick={handleBrowse} style={{ ...secondaryBtn, flexShrink: 0 }}>
              Browse
            </button>
          </div>
        </div>
      </section>

      {/* About */}
      <section>
        <div style={sectionLabel}>About</div>
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={fieldLabel}>Version</div>
            <div style={{ ...fieldValue, fontFamily: 'var(--font-mono)' }}>
              {appVersion ?? '—'}
            </div>
          </div>
          <button
            onClick={() => window.localforge.app.openExternal('https://github.com/xUnscene/LocalForge/releases')}
            style={{ ...secondaryBtn, color: 'var(--color-accent)', background: 'transparent' }}
          >
            Check for updates
          </button>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Run Settings screen tests**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\\Program Files\\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\\AI\\Projects\\SimpliGen\\.worktrees\\plan-7-settings'; & 'C:\\Program Files\\nodejs\\npm.cmd' run test -- tests/renderer/Settings.test.tsx"
```

Expected: PASS (4 tests)

- [ ] **Step 5: Run all Electron tests**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\\Program Files\\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\\AI\\Projects\\SimpliGen\\.worktrees\\plan-7-settings'; & 'C:\\Program Files\\nodejs\\npm.cmd' run test"
```

Expected: 56 passes (46 existing + 3 settings-db + 3 settings store + 4 settings screen). Report actual count if different.

- [ ] **Step 6: Run sidecar tests to confirm no regressions**

```bash
cd "f:/AI/Projects/SimpliGen/.worktrees/plan-7-settings/sidecar" && python -m pytest -v
```

Expected: 50 passes.

- [ ] **Step 7: Commit**

```bash
git -C "f:/AI/Projects/SimpliGen/.worktrees/plan-7-settings" add src/renderer/src/screens/Settings.tsx tests/renderer/Settings.test.tsx
git -C "f:/AI/Projects/SimpliGen/.worktrees/plan-7-settings" commit -m "feat: add Settings screen (GPU readout, ComfyUI restart, output folder, app version)"
```

---

## Verification

Plan 7 is complete when:

- [ ] `npm run test` → 56/56 PASS
- [ ] `cd sidecar && python -m pytest -v` → 50/50 PASS
- [ ] `npm run dev` → Settings nav icon opens the Settings screen
- [ ] Settings screen shows detected GPU name and VRAM
- [ ] ComfyUI status shows "running", "stopped", or "error" with matching color
- [ ] "Restart Engine" button disables during restart, re-enables after
- [ ] Output folder path shows current path; Browse button opens folder picker
- [ ] App version shows "1.0.0"; "Check for updates" opens GitHub releases in browser
- [ ] Switching away and back to Settings re-fetches fresh GPU + engine status

---

## Notes for Implementer

- **Node PATH**: Run all npm commands with PowerShell PATH prefix (same pattern as Plans 1–6)
- **Worktree path**: `f:/AI/Projects/SimpliGen/.worktrees/plan-7-settings/`
- **Sidecar port in tests**: `window.localforge.sidecar.getStatus` is stubbed to return `{ status: 'running', port: 8765 }` — all fetch URL assertions should use port `8765`
- **`vi.clearAllMocks()` in tests**: Clears call history but not mock implementations. The `beforeEach` in Settings.test.tsx stubs `fetch` explicitly each time — this ensures the on-mount fetch calls don't produce unhandled promise rejections
- **GPU endpoint returns**: `{ detected: bool, name: str | null, vram_gb: float | null }` — `vram_gb` is a float (e.g., `24.0`), displayed as `{vramGb} GB VRAM`
- **Engine status values**: `'not_installed' | 'stopped' | 'running' | 'error'` — the `ComfyStatus` type in the store uses `'running' | 'stopped' | 'starting' | 'error' | null`; `'not_installed'` from the sidecar maps to `'stopped'` in the UI (no separate display needed)
- **`dialog.showOpenDialog`**: Only available in the main process. The `settings:browseOutputPath` IPC handler calls it from main and returns the path to the renderer
- **`shell.openExternal`**: Available in main process only — exposed via `app:openExternal` IPC. Do NOT call it directly from the renderer
- **Restart flow**: `POST /engine/stop` → `POST /engine/start` → `GET /engine/status`. Uses `try/finally` so `isRestarting` is always reset to `false` even if a fetch fails

---

## Next Plans

| Plan | Feature | Depends on |
|---|---|---|
| Plan 8 | Packaging (Electron Builder NSIS, PyInstaller sidecar, code signing) | All |
