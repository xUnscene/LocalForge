# LocalForge — Session Summary (2026-04-23, Session 5)

## What this is
**LocalForge** — Windows desktop app for local AI image generation. Electron + React + TypeScript frontend, Python FastAPI sidecar, ComfyUI inference backend. Git repo: `f:\AI\Projects\SimpliGen\` → `https://github.com/xUnscene/LocalForge`.

---

## Status: STABLE — master clean, all plans implemented, all tests passing

`master` is the active branch, pushed to origin. All plan features are implemented. All tests pass.

---

## What was done this session

### 1. Committed scaffold work from prior session (`336f13a`)

16 files of uncommitted in-progress work were investigated, found to be coherent scaffold features, and committed as one commit:

- **Auto-start ComfyUI on generate** — `generate.py` checks if engine is running, starts it if not, streams `starting_engine` SSE events while polling `http://127.0.0.1:8188/system_stats` with a 90s timeout
- **Model selection (Step 4)** — Generate screen adds a Model step; selected model passed through SSE payload and wired to `build_workflow()` checkpoint param via `model_manager.resolve_checkpoint_filename()`
- **Image serving via HTTP** — `/output/{filename}` sidecar endpoint; frontend uses `http://127.0.0.1:{port}/output/{filename}` instead of `file:///` URIs; CSP updated to allow `http://127.0.0.1:*` in `img-src`
- **Engine dir configurable** — `settings:getEngineDir`, `settings:setEngineDir`, `settings:browseEngineDir` IPC handlers; Settings UI "Storage" section; sidecar restarted on change with `LOCALFORGE_ENGINE_DIR` env var
- **Models IPC** — `models:openCheckpointsFolder`, `models:importLocal` handlers
- **Better ComfyUI error parsing** — `generation_runner.py` extracts `exception_message` from ComfyUI error payloads
- **CLAUDE.MD.md → CLAUDE.md** — renamed (git detected as rename)

### 2. Merged `feature/thumbnail-generation` into master (`a91d31f`)

Branch had diverged — two conflict files required manual resolution:

- **`sidecar/routers/generate.py`**: Kept HEAD's auto-start logic; added `thumbnail_path: None` to `_err()` helper and `starting_engine` event payload; kept `/thumbnail/{filename}` endpoint from feature branch
- **`sidecar/services/comfyui_manager.py`**: Removed duplicate `self._log_path` assignment and orphaned `if log_file: log_file.close()` block (from feature branch's text-mode approach); kept HEAD's binary-mode `log_fh` handle

### 3. Pushed master to origin

Master is current on GitHub at `a91d31f`.

### 4. Audited remaining plans

All four plans (2, 6, 7, 8) are already fully implemented in the codebase:
- **Plan 2 (Sidecar)**: Health, engine, generate, models, setup routers all exist; 13 sidecar test files
- **Plan 6 (Library)**: `Library.tsx` fully implemented with grid, hover overlay, modal, Re-generate
- **Plan 7 (Settings)**: `Settings.tsx` has GPU, ComfyUI status, restart, output path, engine dir
- **Plan 8 (Packaging)**: `electron-builder.config.js` and `scripts/build-release.bat` are complete

### 5. Ran tests — found 1 failure

**npm test: 1 failed / 69 passed (70 total)**

The single failure was in `tests/main/setup.test.ts` — fixed in Session 6 (see below).

Sidecar tests were not re-run this session.

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

### Test setup
- `npm test` rebuilds better-sqlite3 for Node ABI automatically (`pretest` script)
- `npm run app:rebuild` rebuilds for Electron ABI (run this before `npm run dev`)
- 18 test files, 70 tests, **1 failing** (see Known Issues)
- Sidecar: `cd sidecar && python -m pytest -v`

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
- Active branch: `master` — clean, pushed to origin (`a91d31f`)
- Worktree: `.worktrees/thumbnail-generation/` (gitignored, can be deleted)
- Recent commits:
  - `a91d31f` Merge feature/thumbnail-generation into master
  - `336f13a` feat: auto-start engine, model selection, HTTP image serving, configurable engine dir
  - `700a359` docs: update session summary for session 4

---

---

## Session 6 (2026-04-23)

### Fixed Electron test (`tests/main/setup.test.ts`)
- Added `writeFileSync` import; updated "returns true" test to create `{tmpDir}/engine/ComfyUI/main.py` and pass `join(tmpDir, 'engine')` as engineDir
- **Result: 70/70 npm tests passing**

### Fixed sidecar tests (`sidecar/tests/test_generate_router.py`)
- 4 tests were failing — generate router added `manager.is_installed()` / `manager.get_status()` guards in Session 5 but tests only mocked `app.state.runner`, not `app.state.manager`
- Added `_mock_manager()` helper returning a MagicMock with `is_installed=True`, `get_status='running'`; applied to all 4 affected tests
- **Result: 56/56 sidecar tests passing**

---

### Diagnosed and fixed app launch failures

**Root cause:** `ELECTRON_RUN_AS_NODE=1` is set in the Claude Code shell environment (Claude Code uses Electron internally). When commands run through Claude, Electron inherits this env var and runs as plain Node.js — `require('electron')` returns the binary path string instead of the module, breaking all Electron APIs.

**Fix 1:** Removed `@electron-toolkit/utils` dependency (first symptom). Inlined the three things it provided:
- `is.dev` → `!app.isPackaged` directly in source
- `electronApp.setAppUserModelId` → direct `app.setAppUserModelId` call (Windows-only guard)
- `optimizer.watchWindowShortcuts` → inlined F12-to-DevTools handler in `index.ts`
- Package removed from `package.json` and `npm install` run

**Fix 2:** When running from Claude Code, must unset `ELECTRON_RUN_AS_NODE` before electron commands:
- `env -u ELECTRON_RUN_AS_NODE npm run app:rebuild` for the Electron ABI rebuild
- `env -u ELECTRON_RUN_AS_NODE npm run dev` to launch the app
- From the user's own terminal (outside Claude Code), just `npm run dev` works normally

**ABI workflow note:** `npm test` (via `pretest`) rebuilds `better-sqlite3` for Node ABI (v137). Before `npm run dev`, run `npx @electron/rebuild -f -w better-sqlite3 --electron-version 36.9.5` (or `npm run app:rebuild` with ELECTRON_RUN_AS_NODE unset) to rebuild for Electron ABI (v135). Running `app:rebuild` → `npm run dev` in the same Claude shell: use `env -u ELECTRON_RUN_AS_NODE` prefix on both.

**App launch confirmed:** `env -u ELECTRON_RUN_AS_NODE npm run dev` started Electron successfully — no errors.

---

## Next steps
1. **Run the app from your own terminal** — `npx @electron/rebuild -f -w better-sqlite3 --electron-version 36.9.5` then `npm run dev` — generate an image, confirm thumbnail appears in Library
2. **Push master to origin** — commit with the `@electron-toolkit/utils` removal and test fixes
