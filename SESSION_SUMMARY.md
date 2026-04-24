# LocalForge — Session Summary (2026-04-24, Session 6)

## What this is
**LocalForge** — Windows desktop app for local AI image generation. Electron + React + TypeScript frontend, Python FastAPI sidecar, ComfyUI inference backend. Git repo: `f:\AI\Projects\SimpliGen\` → `https://github.com/xUnscene/LocalForge`.

---

## Status: STABLE — all tests passing, app confirmed working end-to-end

`master` is the active branch. All plans implemented, 70/70 Electron tests + 56/56 sidecar tests passing. App launches and generates images successfully.

---

## What was done this session

### 1. Fixed Electron test (`tests/main/setup.test.ts`)

`isSetupComplete(engineDir)` checks for `join(engineDir, 'ComfyUI', 'main.py')` but the test was passing `tmpDir` (not `join(tmpDir, 'engine')`) as engineDir and never created `main.py`.

- Added `writeFileSync` import
- Updated "returns true" test to create `{tmpDir}/engine/ComfyUI/main.py` and pass `join(tmpDir, 'engine')` as engineDir
- **Result: 70/70 npm tests passing**

### 2. Fixed sidecar generate router tests (`sidecar/tests/test_generate_router.py`)

4 tests were failing because the generate router (added in session 5) checks `manager.is_installed()` / `manager.get_status()` before touching the runner. Tests only mocked `app.state.runner`, not `app.state.manager`, so the is-installed guard short-circuited before runner logic ran.

- Added `_mock_manager()` helper: MagicMock with `is_installed=True`, `get_status='running'`
- Applied to all 4 affected tests
- **Result: 56/56 sidecar tests passing**

### 3. Diagnosed and fixed app launch failure

**Root cause:** `ELECTRON_RUN_AS_NODE=1` is set in Claude Code's shell (Claude Code is itself an Electron app). The Electron child process inherits this env var and runs as plain Node.js instead of as an Electron app. In that mode, `require('electron')` returns the binary path string rather than the module, breaking all Electron APIs (`app`, `BrowserWindow`, `ipcMain`, etc.).

This caused two symptoms that appeared as separate bugs:
1. `@electron-toolkit/utils` crashed at load time — it evaluates `electron.app.isPackaged` eagerly at module initialization
2. After removing that package, the app itself crashed — `electron.app.whenReady()` also undefined

**Fix:** Removed `@electron-toolkit/utils` dependency and inlined its functionality directly:
- `is.dev` → `!app.isPackaged` in both `index.ts` and `sidecar.ts`
- `electronApp.setAppUserModelId(id)` → direct `app.setAppUserModelId(id)` with `process.platform === 'win32'` guard
- `optimizer.watchWindowShortcuts(win)` → inlined F12-to-DevTools toggle in `index.ts`

**Also fixed:** `better-sqlite3` ABI mismatch. `npm test` (via `pretest`) rebuilds it for system Node ABI (v137). Electron 36 needs ABI v135. After running tests, must rebuild for Electron before launching the app.

**App launch confirmed working end-to-end.** Generation produces images, thumbnails appear in Library.

---

## Current architecture decisions / known state

### Image serving
- Full-res images: `GET /output/{filename}` — served from `<engine_dir>/ComfyUI/output/`
- Thumbnails: `GET /thumbnail/{filename}` — served from `<engine_dir>/ComfyUI/thumbnails/`
- Generate screen: `outputImageUrl` local state, set on SSE `complete` event via HTTP URL
- Library grid: `thumbnailUrl()` → `/thumbnail/` if `thumbnail_path` set, falls back to `/output/`
- Library modal: always `outputUrl()` → full resolution
- `thumbnail_path` DB column populated after generation; old records have `''` (fallback handled)

### Engine dir
- Configurable in Settings UI → stored in SQLite `settings` table as `engine_dir`
- Read at sidecar startup via `LOCALFORGE_ENGINE_DIR` env var (set by `sidecar.ts` before spawning)
- `isSetupComplete(engineDir)` checks for `join(engineDir, 'ComfyUI', 'main.py')`
- Engine dir on this machine: `F:\AI\Projects\SimpliGen\localforge`

### Generate flow
- SSE statuses: `starting_engine` → `queued` → `generating` → `complete` | `error`
- Auto-start: polls `/system_stats` every 2s up to 90s; streams `starting_engine` events during wait
- Model selection: Step 4 in Generate sidebar; defaults to `zimage.safetensors`
- `thumbnail_path` included in all SSE payloads (null when not yet generated)

### Dev workflow — ABI management
`npm test` rebuilds `better-sqlite3` for **Node ABI** (v137) via `pretest`. Before running the app, rebuild for **Electron ABI** (v135):

```
npx @electron/rebuild -f -w better-sqlite3 --electron-version 36.9.5
npm run dev
```

`npm run app:rebuild` does the same thing but must be run from a terminal where `ELECTRON_RUN_AS_NODE` is not set (i.e., from your own PowerShell, not through Claude Code).

---

## Known issues

None.

---

## Environment facts
- Python 3.14 (default `py`) runs sidecar; Python 3.10 required for ComfyUI venv
- Engine dir: `F:\AI\Projects\SimpliGen\localforge` (set in DB, passed via `LOCALFORGE_ENGINE_DIR` env var)
- ComfyUI installed at: `F:\AI\Projects\SimpliGen\localforge\ComfyUI` ✓
- DB: `C:\Users\jonea\AppData\Roaming\localforge\localforge.db`
- ComfyUI log: `C:\Users\jonea\AppData\Roaming\LocalForge\comfyui.log`
- Sidecar log: `C:\Users\jonea\AppData\Roaming\LocalForge\sidecar.log`
- GPU: NVIDIA GeForce RTX 3080 Ti (12GB VRAM)
- `gh` CLI not installed — PRs must be created manually via GitHub web UI

---

## Git state
- Active branch: `master` — 2 commits ahead of origin, ready to push
- Recent commits:
  - `8482ee4` fix: remove @electron-toolkit/utils, inline dev-mode helpers
  - `8e2937c` fix: repair all failing tests — setup.test.ts path and sidecar generate router mocks
  - `a91d31f` Merge feature/thumbnail-generation into master

---

## Next steps
1. **Push master to origin** — `git push origin master`
2. **Package for distribution** — `npm run build:release` (Plan 8 is already implemented)
