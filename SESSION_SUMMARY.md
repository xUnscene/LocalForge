# LocalForge — Session Summary (2026-04-24, Session 7)

## What this is
**LocalForge** — Windows desktop app for local AI image generation. Electron + React + TypeScript frontend, Python FastAPI sidecar, ComfyUI inference backend. Git repo: `f:\AI\Projects\SimpliGen\` → `https://github.com/xUnscene/LocalForge`.

---

## Status: SHIPPED — installer built and confirmed working

`master` is the active branch. All 126 tests passing. First packaged Windows installer (`dist\LocalForge Setup 1.0.0.exe`) built and confirmed launching successfully.

---

## What was done this session

### 1. Pushed master to origin

Two commits from session 6 were pending. Pushed cleanly.

### 2. Fixed `build:sidecar` — pyinstaller not on PATH

`pip install pyinstaller` installs to `C:\Users\jonea\AppData\Roaming\Python\Python314\Scripts` which is not on PATH, so bare `pyinstaller` fails.

**Fix:** Changed `build:sidecar` script in `package.json` to use `py -m PyInstaller` instead of `pyinstaller`.

### 3. Fixed electron-builder config — silently ignored .config.js

`electron-builder v26` silently ignores `electron-builder.config.js`. The effective config was resolving to `files: []` (falling back to package-everything defaults), which caused it to try to bundle the 4.2GB+ ComfyUI model file into the ASAR archive (ASAR has a 4.2GB per-file limit).

**Fix:**
- Deleted `electron-builder.config.js`
- Moved the entire build config into `package.json` under a `"build"` key (electron-builder's highest-priority config location — confirmed by `loaded configuration file=package.json ("build" field)` in output)
- Added file exclusions: `!localforge/**`, `!sidecar/**`, `!.worktrees/**`, `!.tmp/**`, `!tools/**`, `!workflows/**`

### 4. Built and installed

```
npm run build:sidecar   # PyInstaller → sidecar/dist/localforge-sidecar.exe
npm run dist:win        # electron-builder → dist/LocalForge Setup 1.0.0.exe
```

Installer ran successfully. App opened after install. ✓

**Note:** `npm run build:sidecar` and `npm run dist:win` must be run from your own PowerShell — not through Claude Code's terminal, where `ELECTRON_RUN_AS_NODE=1` is set.

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

### Build workflow
`npm run build:release` = `npm run build && npm run build:sidecar && npm run dist:win`

Must be run from your own PowerShell (not Claude Code terminal) — `ELECTRON_RUN_AS_NODE=1` is set in Claude Code's shell and breaks Electron builds.

### Dev workflow — ABI management
`npm test` rebuilds `better-sqlite3` for **Node ABI** (v137) via `pretest`. Before running the app in dev mode, rebuild for **Electron ABI** (v135):

```
npx @electron/rebuild -f -w better-sqlite3 --electron-version 36.9.5
npm run dev
```

Run from your own PowerShell, not through Claude Code.

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
- Active branch: `master` — up to date with origin
- Recent commits:
  - `f1001a1` build: move electron-builder config into package.json, fix pyinstaller path
  - `18a9b0e` docs: update session summary for session 6
  - `8482ee4` fix: remove @electron-toolkit/utils, inline dev-mode helpers

---

## Next steps
No outstanding items. App is packaged and working. Future sessions: feature work or bug fixes as needed.
