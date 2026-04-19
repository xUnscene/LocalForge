# LocalForge — Design Spec & Implementation Plan
**Date:** 2026-04-19
**Move to:** `docs/superpowers/specs/2026-04-19-localforge-design.md` after plan mode exits

---

## Context

The user wants to build **LocalForge**, a Windows desktop application for local AI image generation. It is inspired by SimpliGen (a $29.99 Gumroad product) but built from scratch with a new name. The core value proposition: one-time purchase, no subscriptions, no censorship filters, simplified local AI generation without ComfyUI's complexity.

**Key decisions made during brainstorming:**
- Name: LocalForge
- Platform: Windows desktop only (v1)
- Monetization: One-time purchase, no DRM, distributed via Gumroad or direct download
- MVP scope: Local image generation only (no video, no cloud BYOK in v1)
- Desktop shell: Electron + React (TypeScript)
- Local model backend: ComfyUI managed silently as a subprocess
- Backend approach: First-run setup wizard (Approach B — download on first launch)
- Distribution: No license key validation

---

## Design Spec

### Architecture

Four layers communicating via well-defined interfaces:

| Layer | Technology | Responsibility |
|---|---|---|
| UI | Electron + React (TypeScript) + Zustand | Window management, rendering, user input |
| Sidecar | PyInstaller .exe (Python + FastAPI) | ComfyUI lifecycle, SSE progress streaming, model downloads from HuggingFace |
| Inference | ComfyUI (pinned version + custom nodes) | GPU inference, VRAM management, scheduler |
| Persistence | SQLite via better-sqlite3 | Generation history, app settings |

**IPC:** Electron main process communicates with sidecar via local REST + SSE on a dynamically negotiated localhost port. Sidecar passes its port back to Electron on startup. Electron uses `ipcMain`/`ipcRenderer` internally for UI↔main process communication.

**Process lifecycle:** Electron main process owns all child processes. On app quit, Electron sends SIGTERM to sidecar which cascades to ComfyUI. Prevents orphaned processes in Task Manager.

**Key architectural decisions:**
- Sidecar is **PyInstaller-frozen** into `localforge-sidecar.exe` and bundled inside the Electron package. No Python download required at runtime.
- ComfyUI is pinned to a **specific commit hash** — updates only on explicit app release, never auto-pulled.
- Z-Image (Lumina-2) requires the `ComfyUI-LuminaWrapper` custom node — installed automatically during setup wizard.
- Progress streaming uses **SSE** (not polling) so the generation progress bar updates in real-time from ComfyUI's native WebSocket events.
- Generation history stored in **SQLite** (`%APPDATA%\LocalForge\localforge.db`). Each record: prompt, seed, model, timestamp, output path, thumbnail path. Thumbnails stored as files in `%APPDATA%\LocalForge\thumbnails\` (256×256 JPEG), path referenced in SQLite.

---

### Screens & Navigation

**Icon sidebar** (4 icons, VS Code-style, narrow):
1. **Generate** — core workflow
2. **Library** — past generations
3. **Models** — install/manage local models
4. **Settings** — hardware info, paths, ComfyUI status

**Generate screen:**
- Left panel: 3-step accordion prompt builder
  - **Step 1 — Subject:** Free-text input + quick-insert suggestion chips
  - **Step 2 — Style:** Preset grid (curated style cards with preview thumbnails)
  - **Step 3 — Shot:** Dropdowns for camera body, lens type, lighting, aspect ratio
- Right panel: Output preview (placeholder until first gen, then shows result with seed/timestamp overlay)
- Bottom bar: Generate button + real-time progress bar during inference + estimated time remaining

**Library screen:**
- Masonry grid of generated images
- Hover shows: model used, prompt snippet, timestamp
- Click opens full-size with full metadata and "Re-generate" action

**Models screen:**
- Cards for each available model (v1: Z-Image / Lumina-2 only)
- Hardware compatibility badge per model ("Perfect for your GPU" / "Needs 12GB+ VRAM")
- One-click Install button → triggers HuggingFace download with progress indicator
- Installed models show size on disk + "Remove" option

**Settings screen:**
- Detected GPU + VRAM readout
- ComfyUI status indicator (Running / Starting / Stopped) + restart button
- Output folder path (configurable)
- App version + check for updates link

---

### First-Run Setup Wizard

Triggered on first launch, fullscreen modal:

1. **Welcome** — LocalForge intro, confirms Windows + NVIDIA GPU detected
2. **Hardware Check** — reads GPU via `nvidia-smi`, shows VRAM, warns if <8GB
3. **Install ComfyUI** — downloads pinned ComfyUI + LuminaWrapper custom node (~800MB), shows progress bar
4. **Ready** — launches into main app, prompts user to install their first model

Setup artifacts stored in `%APPDATA%\LocalForge\engine\`. Log at `%APPDATA%\LocalForge\logs\setup.log`.

---

### Prompt Assembly

The 3-step wizard assembles a structured prompt that's sent to the sidecar, which constructs the ComfyUI workflow JSON:

```
Subject: "a woman walking through a neon-lit Tokyo street"
Style: "Cinematic • High Contrast"
Shot: Camera: Sony A7IV | Lens: 35mm f/1.4 | Lighting: Chiaroscuro | Ratio: 16:9
```

Assembled into a cinematographic prompt string respecting Lumina-2's conditioning format, then mapped to ComfyUI's KSampler node parameters.

---

### Error Handling

| Scenario | Response |
|---|---|
| Setup fails mid-download | Retry button, partial files cleaned, log written |
| ComfyUI process crashes | Sidecar auto-restarts once; if fails again, UI shows "Restart Engine" button |
| VRAM out of memory | "Not enough VRAM — try reducing output resolution or switching to a lighter model" |
| Model download interrupted | Partial file cleaned, download is resumable |
| GPU not detected on launch | Warning banner before user attempts generation |
| Sidecar port conflict | Sidecar tries next available port, retries up to 5 times |
| App closed mid-generation | Sidecar cancels ComfyUI queue on SIGTERM |

---

### Visual Style

- **Theme:** Dark only (no light mode in v1)
- **Background:** `#252525` (graphite)
- **Surface:** `#2E2E2E` (raised panels)
- **Accent:** `#F97316` → `#FB923C` gradient (CTAs, active states, progress bar)
- **Accent solid:** `#F97316` (icons, borders, focus rings)
- **Text:** `#F0F0F0` primary, `#999999` secondary
- **Font:** Inter (UI), JetBrains Mono (prompt output/seed display)
- **Aesthetic:** Subtle orange glow on active elements (`box-shadow: 0 2px 10px #F9731666`), 6px border radius throughout, gradient on primary buttons

---

### Testing

- **Unit:** Prompt assembly logic — given Subject + Style + Shot inputs, verify correct ComfyUI workflow JSON output
- **Integration:** Sidecar ↔ ComfyUI API roundtrip using a lightweight test model (no GPU required in CI)
- **Manual E2E:** Full setup wizard run on clean Windows 10 VM before each release
- **Hardware matrix:** Smoke test on 8GB, 12GB, 16GB VRAM cards before shipping
- **Process cleanup:** Verify no orphaned processes remain after force-quit

---

## Implementation Plan

> Plans 2–8 will be written after Plan 1 ships. Each plan produces independently testable software.
> Build order: 1 (scaffold) → 2 (sidecar) → 3 (setup wizard) → 4 (generate) → 5 (models) → 6 (library) → 7 (settings) → 8 (packaging)

---

# Plan 1: Foundation Scaffold
**Save to:** `docs/superpowers/plans/2026-04-19-localforge-plan-1-scaffold.md`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Electron + React app with icon sidebar navigation, themed UI (graphite + orange), Zustand store, and SQLite database — no AI functionality yet, just the shell every other plan builds on.

**Architecture:** electron-vite handles dual-process build (main + renderer). React renderer uses conditional screen rendering driven by Zustand (no URL router needed for 4 screens). SQLite runs in the main process via better-sqlite3 and is accessed from the renderer via IPC.

**Tech Stack:** Electron 32, React 18, TypeScript 5, electron-vite 2, Zustand 4, better-sqlite3 9, Vitest, React Testing Library

---

### File Map

```
localforge/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts                        # electron-vite config
├── electron-builder.config.js
├── src/
│   ├── main/
│   │   ├── index.ts                      # Electron entry, window creation, app lifecycle
│   │   ├── ipc.ts                        # IPC handler registration (thin router)
│   │   └── database.ts                   # SQLite schema init, query helpers
│   ├── preload/
│   │   └── index.ts                      # contextBridge — exposes typed API to renderer
│   └── renderer/
│       ├── index.html
│       ├── main.tsx                      # React entry point
│       ├── App.tsx                       # Root: Sidebar + active screen
│       ├── store/
│       │   └── app.store.ts              # Zustand: active screen, app-wide state
│       ├── screens/
│       │   ├── Generate.tsx              # Placeholder shell
│       │   ├── Library.tsx               # Placeholder shell
│       │   ├── Models.tsx                # Placeholder shell
│       │   └── Settings.tsx              # Placeholder shell
│       ├── components/
│       │   └── Sidebar.tsx               # Icon sidebar with 4 nav items
│       └── styles/
│           └── globals.css               # CSS custom properties (theme tokens)
└── tests/
    ├── main/
    │   └── database.test.ts
    └── renderer/
        ├── App.test.tsx
        └── Sidebar.test.tsx
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `electron-builder.config.js`

- [ ] **Step 1: Initialize project**

```bash
mkdir localforge && cd localforge
npm create @quick-start/electron@latest . -- --template react-ts
```

When prompted: project name `localforge`, framework `React`, variant `TypeScript`.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install zustand better-sqlite3
npm install -D @types/better-sqlite3 vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Update `package.json` scripts section**

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run",
    "test:ui": "vitest --ui"
  }
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```typescript
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: { plugins: [react()] }
})
```

- [ ] **Step 5: Create `electron-builder.config.js`**

```javascript
module.exports = {
  appId: 'com.localforge.app',
  productName: 'LocalForge',
  directories: { output: 'dist' },
  win: { target: 'nsis', icon: 'resources/icon.ico' },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true }
}
```

- [ ] **Step 6: Run dev to confirm scaffold works**

```bash
npm run dev
```

Expected: Electron window opens with default electron-vite starter UI. No errors in terminal.

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: initialize electron-vite + react-ts scaffold"
```

---

### Task 2: CSS Theme Tokens

**Files:**
- Create: `src/renderer/styles/globals.css`
- Modify: `src/renderer/main.tsx` (import globals.css)

- [ ] **Step 1: Write failing test — verify CSS variables load**

```typescript
// tests/renderer/theme.test.ts
import { describe, it, expect } from 'vitest'

describe('theme tokens', () => {
  it('defines required CSS custom properties', () => {
    // Load the CSS and verify the variable names exist in the source
    const fs = require('fs')
    const css = fs.readFileSync('src/renderer/styles/globals.css', 'utf8')
    expect(css).toContain('--color-bg')
    expect(css).toContain('--color-surface')
    expect(css).toContain('--color-accent')
    expect(css).toContain('--color-text-primary')
    expect(css).toContain('--color-text-secondary')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/renderer/theme.test.ts
```

Expected: FAIL — file does not exist yet.

- [ ] **Step 3: Create `src/renderer/styles/globals.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --color-bg: #252525;
  --color-surface: #2E2E2E;
  --color-surface-raised: #333333;
  --color-accent: #F97316;
  --color-accent-light: #FB923C;
  --color-accent-glow: rgba(249, 115, 22, 0.4);
  --color-border: #3D3D3D;
  --color-text-primary: #F0F0F0;
  --color-text-secondary: #999999;
  --radius: 6px;
  --font-ui: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}

body {
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  overflow: hidden;
}

#root { width: 100vw; height: 100vh; display: flex; }

button {
  cursor: pointer;
  border: none;
  outline: none;
  font-family: var(--font-ui);
}

.btn-primary {
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-light));
  color: white;
  padding: 8px 20px;
  border-radius: var(--radius);
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 2px 10px var(--color-accent-glow);
  transition: opacity 0.15s;
}

.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 4: Import in `src/renderer/main.tsx`**

```typescript
import './styles/globals.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test -- tests/renderer/theme.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/styles/globals.css src/renderer/main.tsx tests/renderer/theme.test.ts
git commit -m "feat: add theme CSS tokens (graphite + orange)"
```

---

### Task 3: Zustand Store

**Files:**
- Create: `src/renderer/store/app.store.ts`
- Test: `tests/renderer/app.store.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/renderer/app.store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../src/renderer/store/app.store'

describe('AppStore', () => {
  beforeEach(() => useAppStore.setState({ activeScreen: 'generate' }))

  it('defaults to generate screen', () => {
    expect(useAppStore.getState().activeScreen).toBe('generate')
  })

  it('navigates to library screen', () => {
    useAppStore.getState().navigate('library')
    expect(useAppStore.getState().activeScreen).toBe('library')
  })

  it('navigates to models screen', () => {
    useAppStore.getState().navigate('models')
    expect(useAppStore.getState().activeScreen).toBe('models')
  })

  it('navigates to settings screen', () => {
    useAppStore.getState().navigate('settings')
    expect(useAppStore.getState().activeScreen).toBe('settings')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/renderer/app.store.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/renderer/store/app.store.ts`**

```typescript
import { create } from 'zustand'

export type Screen = 'generate' | 'library' | 'models' | 'settings'

interface AppState {
  activeScreen: Screen
  navigate: (screen: Screen) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeScreen: 'generate',
  navigate: (screen) => set({ activeScreen: screen })
}))
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- tests/renderer/app.store.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/store/app.store.ts tests/renderer/app.store.test.ts
git commit -m "feat: add Zustand store with screen navigation"
```

---

### Task 4: Sidebar Component

**Files:**
- Create: `src/renderer/components/Sidebar.tsx`
- Test: `tests/renderer/Sidebar.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// tests/renderer/Sidebar.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Sidebar } from '../../src/renderer/components/Sidebar'
import { useAppStore } from '../../src/renderer/store/app.store'

describe('Sidebar', () => {
  it('renders 4 nav items', () => {
    render(<Sidebar />)
    expect(screen.getByTitle('Generate')).toBeInTheDocument()
    expect(screen.getByTitle('Library')).toBeInTheDocument()
    expect(screen.getByTitle('Models')).toBeInTheDocument()
    expect(screen.getByTitle('Settings')).toBeInTheDocument()
  })

  it('highlights active screen', () => {
    useAppStore.setState({ activeScreen: 'library' })
    render(<Sidebar />)
    expect(screen.getByTitle('Library').closest('button')).toHaveClass('active')
  })

  it('calls navigate on click', () => {
    useAppStore.setState({ activeScreen: 'generate' })
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle('Models').closest('button')!)
    expect(useAppStore.getState().activeScreen).toBe('models')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/renderer/Sidebar.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/renderer/components/Sidebar.tsx`**

```tsx
import { useAppStore, Screen } from '../store/app.store'

const NAV_ITEMS: { screen: Screen; label: string; icon: string }[] = [
  { screen: 'generate', label: 'Generate', icon: '⚡' },
  { screen: 'library',  label: 'Library',  icon: '🖼' },
  { screen: 'models',   label: 'Models',   icon: '📦' },
  { screen: 'settings', label: 'Settings', icon: '⚙' },
]

export function Sidebar() {
  const { activeScreen, navigate } = useAppStore()

  return (
    <aside style={{
      width: 56,
      background: '#1C1C1C',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px 0',
      gap: 4,
      flexShrink: 0,
    }}>
      <div style={{
        width: 28, height: 28,
        background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-light))',
        borderRadius: 'var(--radius)',
        marginBottom: 16,
        boxShadow: '0 0 12px var(--color-accent-glow)',
      }} />
      {NAV_ITEMS.map(({ screen, label, icon }) => (
        <button
          key={screen}
          title={label}
          className={activeScreen === screen ? 'active' : ''}
          onClick={() => navigate(screen)}
          style={{
            width: 40, height: 40,
            background: activeScreen === screen ? 'var(--color-surface)' : 'transparent',
            borderRadius: 'var(--radius)',
            fontSize: 18,
            color: activeScreen === screen ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
            boxShadow: activeScreen === screen ? '0 0 8px var(--color-accent-glow)' : 'none',
          }}
        >
          <span title={label}>{icon}</span>
        </button>
      ))}
    </aside>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- tests/renderer/Sidebar.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Sidebar.tsx tests/renderer/Sidebar.test.tsx
git commit -m "feat: add icon sidebar with screen navigation"
```

---

### Task 5: Screen Shells + App Root

**Files:**
- Create: `src/renderer/screens/Generate.tsx`
- Create: `src/renderer/screens/Library.tsx`
- Create: `src/renderer/screens/Models.tsx`
- Create: `src/renderer/screens/Settings.tsx`
- Create: `src/renderer/App.tsx`
- Test: `tests/renderer/App.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// tests/renderer/App.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import App from '../../src/renderer/App'
import { useAppStore } from '../../src/renderer/store/app.store'

describe('App', () => {
  it('shows Generate screen by default', () => {
    useAppStore.setState({ activeScreen: 'generate' })
    render(<App />)
    expect(screen.getByTestId('screen-generate')).toBeInTheDocument()
  })

  it('switches to Library screen on nav click', () => {
    useAppStore.setState({ activeScreen: 'generate' })
    render(<App />)
    fireEvent.click(screen.getByTitle('Library').closest('button')!)
    expect(screen.getByTestId('screen-library')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/renderer/App.test.tsx
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create screen shells**

```tsx
// src/renderer/screens/Generate.tsx
export function Generate() {
  return <div data-testid="screen-generate" style={{ flex: 1, padding: 24 }}>
    <h1 style={{ color: 'var(--color-text-secondary)', fontWeight: 300 }}>Generate</h1>
  </div>
}
```

```tsx
// src/renderer/screens/Library.tsx
export function Library() {
  return <div data-testid="screen-library" style={{ flex: 1, padding: 24 }}>
    <h1 style={{ color: 'var(--color-text-secondary)', fontWeight: 300 }}>Library</h1>
  </div>
}
```

```tsx
// src/renderer/screens/Models.tsx
export function Models() {
  return <div data-testid="screen-models" style={{ flex: 1, padding: 24 }}>
    <h1 style={{ color: 'var(--color-text-secondary)', fontWeight: 300 }}>Models</h1>
  </div>
}
```

```tsx
// src/renderer/screens/Settings.tsx
export function Settings() {
  return <div data-testid="screen-settings" style={{ flex: 1, padding: 24 }}>
    <h1 style={{ color: 'var(--color-text-secondary)', fontWeight: 300 }}>Settings</h1>
  </div>
}
```

- [ ] **Step 4: Create `src/renderer/App.tsx`**

```tsx
import { useAppStore } from './store/app.store'
import { Sidebar } from './components/Sidebar'
import { Generate } from './screens/Generate'
import { Library } from './screens/Library'
import { Models } from './screens/Models'
import { Settings } from './screens/Settings'

const SCREENS = {
  generate: <Generate />,
  library: <Library />,
  models: <Models />,
  settings: <Settings />,
}

export default function App() {
  const { activeScreen } = useAppStore()
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <Sidebar />
      {SCREENS[activeScreen]}
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test
```

Expected: All tests PASS.

- [ ] **Step 6: Run dev to verify visually**

```bash
npm run dev
```

Expected: Electron window opens. Dark graphite background, narrow left sidebar with orange accent icon, 4 nav icons. Clicking each icon switches the screen label. No console errors.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/screens/ src/renderer/App.tsx tests/renderer/App.test.tsx
git commit -m "feat: add screen shells and App root with sidebar routing"
```

---

### Task 6: Electron Main Process + Window Config

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Update `src/main/index.ts` with correct window config**

```typescript
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: true,
    backgroundColor: '#252525',
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.localforge.app')
  app.on('browser-window-created', (_, win) => optimizer.watchShortcuts(win))
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 2: Verify dev still works**

```bash
npm run dev
```

Expected: Window opens at 1200×800, dark background visible immediately before React loads (no white flash). No console errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: configure electron window (size, bg color, security)"
```

---

### Task 7: SQLite Database Module

**Files:**
- Create: `src/main/database.ts`
- Modify: `src/main/index.ts` (import and init database)
- Test: `tests/main/database.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/main/database.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { initDatabase, getDatabase } from '../../src/main/database'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'localforge-test-'))
  initDatabase(join(tmpDir, 'test.db'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true })
})

describe('database', () => {
  it('creates generations table', () => {
    const db = getDatabase()
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
    const names = tables.map((t: any) => t.name)
    expect(names).toContain('generations')
  })

  it('inserts and retrieves a generation record', () => {
    const db = getDatabase()
    db.prepare(`
      INSERT INTO generations (id, prompt, seed, model, output_path, thumbnail_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('test-id-1', 'a cat', 42, 'z-image', '/outputs/test.png', '/thumbnails/test.jpg', Date.now())

    const row: any = db.prepare('SELECT * FROM generations WHERE id = ?').get('test-id-1')
    expect(row.prompt).toBe('a cat')
    expect(row.seed).toBe(42)
    expect(row.model).toBe('z-image')
  })

  it('retrieves all generations ordered by created_at desc', () => {
    const db = getDatabase()
    const insert = db.prepare(`
      INSERT INTO generations (id, prompt, seed, model, output_path, thumbnail_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    insert.run('id-1', 'first', 1, 'z-image', '/out/1.png', '/thumb/1.jpg', 1000)
    insert.run('id-2', 'second', 2, 'z-image', '/out/2.png', '/thumb/2.jpg', 2000)

    const rows: any[] = db.prepare('SELECT * FROM generations ORDER BY created_at DESC').all()
    expect(rows[0].id).toBe('id-2')
    expect(rows[1].id).toBe('id-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/main/database.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/main/database.ts`**

```typescript
import Database from 'better-sqlite3'
import type { Database as DB } from 'better-sqlite3'

let db: DB

export function initDatabase(dbPath: string): void {
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS generations (
      id            TEXT PRIMARY KEY,
      prompt        TEXT NOT NULL,
      seed          INTEGER NOT NULL,
      model         TEXT NOT NULL,
      output_path   TEXT NOT NULL,
      thumbnail_path TEXT NOT NULL,
      created_at    INTEGER NOT NULL
    )
  `)
}

export function getDatabase(): DB {
  if (!db) throw new Error('Database not initialized — call initDatabase() first')
  return db
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- tests/main/database.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Import and init database in `src/main/index.ts`**

Add to the top of `index.ts`:
```typescript
import { initDatabase } from './database'
import { app } from 'electron'
import { join } from 'path'
```

Add inside `app.whenReady().then(() => { ... })`, before `createWindow()`:
```typescript
const dbPath = join(app.getPath('userData'), 'localforge.db')
initDatabase(dbPath)
```

- [ ] **Step 6: Run all tests**

```bash
npm run test
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main/database.ts src/main/index.ts tests/main/database.test.ts
git commit -m "feat: add SQLite database init with generations schema"
```

---

### Task 8: Preload + IPC Bridge

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Update `src/preload/index.ts` with typed contextBridge**

```typescript
import { contextBridge, ipcRenderer } from 'electron'

export const api = {
  db: {
    getAllGenerations: () => ipcRenderer.invoke('db:getAllGenerations'),
  }
}

contextBridge.exposeInMainWorld('localforge', api)

declare global {
  interface Window {
    localforge: typeof api
  }
}
```

- [ ] **Step 2: Create `src/main/ipc.ts` with IPC handlers**

```typescript
import { ipcMain } from 'electron'
import { getDatabase } from './database'

export function registerIpcHandlers(): void {
  ipcMain.handle('db:getAllGenerations', () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM generations ORDER BY created_at DESC').all()
  })
}
```

- [ ] **Step 3: Register IPC handlers in `src/main/index.ts`**

Add import:
```typescript
import { registerIpcHandlers } from './ipc'
```

Add inside `app.whenReady()` before `createWindow()`:
```typescript
registerIpcHandlers()
```

- [ ] **Step 4: Run dev and verify no console errors**

```bash
npm run dev
```

Open DevTools (Ctrl+Shift+I in the window). In console, run:
```javascript
window.localforge.db.getAllGenerations().then(console.log)
```

Expected: `[]` (empty array — no generations yet). No errors.

- [ ] **Step 5: Commit**

```bash
git add src/preload/index.ts src/main/ipc.ts src/main/index.ts
git commit -m "feat: add contextBridge IPC with db:getAllGenerations handler"
```

---

### Task 9: Vitest Config

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
  },
})
```

- [ ] **Step 2: Create `tests/setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Run all tests to confirm everything passes**

```bash
npm run test
```

Expected: All tests PASS. Output shows test count per file.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts tests/setup.ts
git commit -m "chore: configure vitest with jsdom and react testing library"
```

---

### Verification

Plan 1 is complete when:

- [ ] `npm run dev` opens a 1200×800 Electron window with graphite background
- [ ] Orange accent sidebar shows 4 nav icons; clicking each switches the content area label
- [ ] No white flash on window open (background color pre-set)
- [ ] `npm run test` passes all tests with zero failures
- [ ] DevTools console: `window.localforge.db.getAllGenerations()` returns `[]` with no errors
- [ ] SQLite file exists at `%APPDATA%\LocalForge\localforge.db` after first run

---

### Next Plans

| Plan | Feature | Depends on |
|---|---|---|
| Plan 2 | Python sidecar (FastAPI + ComfyUI manager + SSE) | Plan 1 |
| Plan 3 | Setup wizard (first-run, hardware detection, ComfyUI install) | Plans 1, 2 |
| Plan 4 | Generate screen (accordion prompt builder, output preview, progress) | Plans 1, 2, 3 |
| Plan 5 | Models screen (model cards, HF download, hardware badges) | Plans 1, 2 |
| Plan 6 | Library screen (generation grid, metadata, full-size viewer) | Plans 1, 4 |
| Plan 7 | Settings screen (GPU readout, ComfyUI status, paths) | Plans 1, 2 |
| Plan 8 | Packaging (Electron Builder, NSIS, code signing) | All |

---

## Verification

After implementation, verify end-to-end:
1. Fresh Windows 10 VM, no prior dependencies
2. Run LocalForge installer → setup wizard completes without errors
3. Install Z-Image model → downloads and appears in Models screen
4. Build a prompt in all 3 accordion steps → Generate → image appears in output panel
5. Image appears in Library with correct metadata
6. Force-close app → confirm no orphaned processes in Task Manager
7. Re-open → Library still shows previous generation
