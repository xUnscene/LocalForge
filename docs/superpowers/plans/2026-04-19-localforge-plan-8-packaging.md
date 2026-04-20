# LocalForge Plan 8: Packaging

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a distributable Windows NSIS installer (`LocalForge-Setup-1.0.0.exe`) by finalising the electron-builder config, adding a sequenced build script, and updating the .gitignore — verified by config-validation tests that can run without a build environment.

**Architecture:** Three layers of artefacts must exist before the installer can be assembled: (1) the TypeScript/React app compiled to `out/` by electron-vite, (2) the Python sidecar frozen to `sidecar/dist/localforge-sidecar.exe` by PyInstaller, and (3) electron-builder stitching them together into `dist/LocalForge-Setup-1.0.0.exe`. The build is Windows-only; electron-builder handles PNG→ICO icon conversion automatically in v26. Code signing is opt-in: if `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` environment variables are set electron-builder signs automatically with no config change required.

**Tech Stack:** electron-builder 26 | PyInstaller 6 | NSIS | Node.js scripts (Vitest for validation)

---

## File Map

```
electron-builder.config.js   MODIFY: fix icon path, add files filter, NSIS shortcuts
package.json                  MODIFY: add build:sidecar, dist:win, build:release scripts
scripts/
└── build-release.bat         NEW: Windows batch script for full release build
.gitignore                    MODIFY: add Python cache dirs

tests/main/
├── build-config.test.ts      NEW: 5 tests validating electron-builder config shape
└── build-scripts.test.ts     NEW: 3 tests validating package.json script presence
```

---

### Task 1: Finalise electron-builder Config

**Files:**
- Modify: `electron-builder.config.js`
- Create: `tests/main/build-config.test.ts`

- [ ] **Step 1: Write the failing test at `tests/main/build-config.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const config = require('../../electron-builder.config.js')

describe('electron-builder config', () => {
  it('has required app identity fields', () => {
    expect(config.appId).toBe('com.localforge.app')
    expect(config.productName).toBe('LocalForge')
  })

  it('targets Windows NSIS x64', () => {
    expect(config.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }])
  })

  it('includes sidecar exe as extra resource', () => {
    const sidecar = config.extraResources.find(
      (r: { from: string; to: string }) => r.to === 'localforge-sidecar.exe'
    )
    expect(sidecar).toBeDefined()
    expect(sidecar.from).toBe('sidecar/dist/localforge-sidecar.exe')
  })

  it('files filter includes out/ and excludes source maps', () => {
    expect(config.files).toContain('out/**')
    expect(config.files).toContain('!out/**/*.map')
  })

  it('NSIS installer creates shortcuts and allows directory selection', () => {
    expect(config.nsis.oneClick).toBe(false)
    expect(config.nsis.allowToChangeInstallationDirectory).toBe(true)
    expect(config.nsis.createDesktopShortcut).toBe(true)
    expect(config.nsis.createStartMenuShortcut).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\\Program Files\\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\\AI\\Projects\\SimpliGen\\.worktrees\\plan-8-packaging'; & 'C:\\Program Files\\nodejs\\npm.cmd' run test -- tests/main/build-config.test.ts"
```

Expected: FAIL — `win.target` is a string not an array, `files` is undefined, NSIS shortcuts not present

- [ ] **Step 3: Replace `electron-builder.config.js` entirely**

```javascript
module.exports = {
  appId: 'com.localforge.app',
  productName: 'LocalForge',
  copyright: 'Copyright © 2025 LocalForge',
  directories: { output: 'dist' },
  files: [
    'out/**',
    '!out/**/*.map',
  ],
  extraResources: [
    { from: 'sidecar/dist/localforge-sidecar.exe', to: 'localforge-sidecar.exe' },
  ],
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'resources/icon.png',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'LocalForge',
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\\Program Files\\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\\AI\\Projects\\SimpliGen\\.worktrees\\plan-8-packaging'; & 'C:\\Program Files\\nodejs\\npm.cmd' run test -- tests/main/build-config.test.ts"
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git -C "f:/AI/Projects/SimpliGen/.worktrees/plan-8-packaging" add electron-builder.config.js tests/main/build-config.test.ts
git -C "f:/AI/Projects/SimpliGen/.worktrees/plan-8-packaging" commit -m "feat: finalise electron-builder config (files filter, NSIS shortcuts, x64 target)"
```

---

### Task 2: Build Scripts and .gitignore

**Files:**
- Modify: `package.json`
- Create: `scripts/build-release.bat`
- Modify: `.gitignore`
- Create: `tests/main/build-scripts.test.ts`

- [ ] **Step 1: Write the failing test at `tests/main/build-scripts.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pkg = require('../../package.json')

describe('package.json build scripts', () => {
  it('has build:sidecar script', () => {
    expect(pkg.scripts['build:sidecar']).toBeDefined()
    expect(pkg.scripts['build:sidecar']).toContain('pyinstaller')
  })

  it('has dist:win script', () => {
    expect(pkg.scripts['dist:win']).toBeDefined()
    expect(pkg.scripts['dist:win']).toContain('electron-builder')
  })

  it('has build:release script that chains build and dist', () => {
    expect(pkg.scripts['build:release']).toBeDefined()
    expect(pkg.scripts['build:release']).toContain('build:sidecar')
    expect(pkg.scripts['build:release']).toContain('dist:win')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\\Program Files\\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\\AI\\Projects\\SimpliGen\\.worktrees\\plan-8-packaging'; & 'C:\\Program Files\\nodejs\\npm.cmd' run test -- tests/main/build-scripts.test.ts"
```

Expected: FAIL — scripts not present

- [ ] **Step 3: Read `package.json` then add three new scripts to the `scripts` section**

Add inside the `"scripts"` object (alongside existing scripts, do not remove any):

```json
"build:sidecar": "cd sidecar && pip install pyinstaller --quiet && pyinstaller localforge-sidecar.spec --clean --noconfirm",
"dist:win": "electron-builder --win",
"build:release": "npm run build && npm run build:sidecar && npm run dist:win"
```

The full `scripts` block should look like:

```json
"scripts": {
  "dev": "electron-vite dev",
  "build": "electron-vite build",
  "preview": "electron-vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui",
  "typecheck:node": "tsc --noEmit -p tsconfig.node.json --composite false",
  "typecheck:web": "tsc --noEmit -p tsconfig.web.json --composite false",
  "typecheck": "npm run typecheck:node && npm run typecheck:web",
  "postinstall": "electron-builder install-app-deps",
  "build:unpack": "npm run build && electron-builder --dir",
  "build:win": "npm run build && electron-builder --win",
  "build:sidecar": "cd sidecar && pip install pyinstaller --quiet && pyinstaller localforge-sidecar.spec --clean --noconfirm",
  "dist:win": "electron-builder --win",
  "build:release": "npm run build && npm run build:sidecar && npm run dist:win"
}
```

- [ ] **Step 4: Run test to verify it passes**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\\Program Files\\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\\AI\\Projects\\SimpliGen\\.worktrees\\plan-8-packaging'; & 'C:\\Program Files\\nodejs\\npm.cmd' run test -- tests/main/build-scripts.test.ts"
```

Expected: PASS (3 tests)

- [ ] **Step 5: Create `scripts/build-release.bat`**

Create directory `scripts/` if it does not exist, then create `scripts/build-release.bat`:

```batch
@echo off
setlocal EnableDelayedExpansion

echo ============================================================
echo  LocalForge Release Build
echo ============================================================
echo.

REM -- Step 1: Build Electron app
echo [1/3] Building Electron app (electron-vite)...
call npm run build
if !errorlevel! neq 0 (
    echo ERROR: Electron build failed.
    exit /b 1
)
echo Done.
echo.

REM -- Step 2: Build Python sidecar
echo [2/3] Building Python sidecar (PyInstaller)...
cd sidecar
pip install pyinstaller --quiet
pyinstaller localforge-sidecar.spec --clean --noconfirm
if !errorlevel! neq 0 (
    echo ERROR: Sidecar build failed.
    exit /b 1
)
cd ..
echo Done.
echo.

REM -- Step 3: Package installer
echo [3/3] Packaging NSIS installer (electron-builder)...
call npm run dist:win
if !errorlevel! neq 0 (
    echo ERROR: Packaging failed.
    exit /b 1
)
echo Done.
echo.

echo ============================================================
echo  Build complete.
echo  Installer: dist\LocalForge Setup 1.0.0.exe
echo ============================================================
echo.

REM List output
if exist "dist\" (
    dir /b dist\*.exe 2>nul
)

endlocal
```

- [ ] **Step 6: Update `.gitignore`**

Read the current `.gitignore`, then replace it with:

```
node_modules
dist
out
.DS_Store
.eslintcache
*.log*

# Python packaging artefacts
sidecar/build/
**/__pycache__/
**/*.pyc
.pytest_cache/
sidecar/**/.pytest_cache/

# Generated icon (if converting from PNG via a tool)
resources/icon.ico
```

Note: `sidecar/dist/` is already covered by the top-level `dist` rule (which matches any `dist` directory at any depth).

- [ ] **Step 7: Run all tests to confirm no regressions**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\\Program Files\\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\\AI\\Projects\\SimpliGen\\.worktrees\\plan-8-packaging'; & 'C:\\Program Files\\nodejs\\npm.cmd' run test"
```

Expected: 67 passes (59 existing + 5 config + 3 scripts). Report actual if different.

- [ ] **Step 8: Run sidecar tests to confirm no regressions**

```bash
cd "f:/AI/Projects/SimpliGen/.worktrees/plan-8-packaging/sidecar" && python -m pytest -q
```

Expected: 50 passes.

- [ ] **Step 9: Commit**

```bash
git -C "f:/AI/Projects/SimpliGen/.worktrees/plan-8-packaging" add package.json scripts/build-release.bat .gitignore tests/main/build-scripts.test.ts
git -C "f:/AI/Projects/SimpliGen/.worktrees/plan-8-packaging" commit -m "feat: add build scripts (build:sidecar, dist:win, build:release) and update .gitignore"
```

---

## Verification

Plan 8 is complete when:

- [ ] `npm run test` → 67/67 PASS
- [ ] `cd sidecar && python -m pytest -q` → 50/50 PASS
- [ ] `electron-builder.config.js` — `win.target` is `[{ target: 'nsis', arch: ['x64'] }]`, `files` includes `out/**`, `nsis` has desktop + start-menu shortcuts
- [ ] `package.json` has `build:sidecar`, `dist:win`, `build:release` scripts
- [ ] `scripts/build-release.bat` exists and prints step progress
- [ ] `.gitignore` excludes `__pycache__`, `sidecar/build/`, `.pyc`

**Manual build verification** (requires Python + PyInstaller installed):
- [ ] `scripts\build-release.bat` runs end-to-end without errors
- [ ] `dist\LocalForge Setup 1.0.0.exe` exists after the build
- [ ] Installing the exe on a clean Windows 10 machine shows the NSIS dialog with directory picker
- [ ] Desktop and Start Menu shortcuts are created after install
- [ ] Launching LocalForge from the shortcut starts the app, sidecar spawns, Settings screen shows ComfyUI status

---

## Notes for Implementer

- **Node PATH**: All npm commands require the PowerShell PATH prefix (same as previous plans)
- **Worktree**: `f:/AI/Projects/SimpliGen/.worktrees/plan-8-packaging/`
- **Icon**: `resources/icon.png` (existing file). electron-builder v26 converts PNG → ICO automatically for NSIS builds using a bundled converter. No manual ico conversion needed.
- **Code signing**: NOT required to build an unsigned installer. When a signing certificate is available, set `WIN_CSC_LINK` (path to .pfx file) and `WIN_CSC_KEY_PASSWORD` (pfx password) as environment variables — electron-builder picks them up automatically without any config change.
- **`build:sidecar` on Windows**: The `cd sidecar && ...` syntax works in PowerShell and cmd. If `npm run build:sidecar` fails because `pip` is not on PATH, run `where python` in the terminal to find the Python executable and adjust accordingly.
- **`build:release` order**: `npm run build` (electron-vite) must run before `npm run dist:win` (electron-builder) because electron-builder packages `out/**` which is the vite output. `build:sidecar` must also run before `dist:win` because electron-builder needs `sidecar/dist/localforge-sidecar.exe` to exist as an extraResource. The order in `build:release` (`build` → `build:sidecar` → `dist:win`) is correct.
- **`createRequire` in tests**: The test files use `createRequire(import.meta.url)` to load CommonJS `.js` and `.json` files in the ESM/TypeScript test environment. This is the standard Node.js pattern — do not use a bare `require()` call at the module level in `.ts` files.

---

## Code Signing Reference (when certificate is ready)

Set these environment variables before running `npm run dist:win` or `scripts\build-release.bat`:

```batch
set WIN_CSC_LINK=C:\path\to\certificate.pfx
set WIN_CSC_KEY_PASSWORD=your-pfx-password
npm run dist:win
```

electron-builder reads `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` automatically. The installer will be Authenticode-signed.

---

## Next Steps After Plan 8

Plan 8 completes the LocalForge v1 feature set. Remaining pre-release checklist:
- Merge all feature branches into `main` via PRs
- Manual E2E test on clean Windows 10 VM
- Hardware matrix smoke test (8 GB, 12 GB, 16 GB VRAM)
- Upload installer to Gumroad or direct download host
