# LocalForge Plan 2: Python Sidecar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A FastAPI sidecar process that Electron spawns on startup, reports its port via stdout, and exposes health and ComfyUI engine-status endpoints — so the Settings screen can show a live engine status indicator.

**Architecture:** Python FastAPI + uvicorn runs as a child process of the Electron main process. On startup the sidecar finds a free TCP port, prints `PORT=<n>` to stdout, then starts serving. Electron reads stdout, extracts the port, and stores it for IPC use. All communication is over `http://127.0.0.1:<port>`. ComfyUI lifecycle management is included but returns `not_installed` until Plan 3 downloads the engine.

**Tech Stack:** Python 3.11+, FastAPI, uvicorn, httpx (tests), pytest, pytest-asyncio | Electron sidecar.ts (child_process.spawn)

**Prerequisites:**
- Python 3.11+ must be on PATH for dev mode (`python --version`)
- `pip install uv` for dependency management (`uv --version`)
- Plan 1 scaffold must be complete (branch `feature/plan-1-scaffold` merged or this branch based on it)

---

## File Map

```
sidecar/                              # Python sidecar source root
├── pyproject.toml                    # deps: fastapi, uvicorn, httpx, pytest, pytest-asyncio
├── main.py                           # entry: find free port → print PORT=n → start uvicorn
├── app.py                            # FastAPI app factory (create_app)
├── routers/
│   ├── __init__.py
│   ├── health.py                     # GET /health → {"status":"running","version":"1.0.0"}
│   └── engine.py                     # GET /engine/status, POST /engine/start, POST /engine/stop
├── services/
│   ├── __init__.py
│   └── comfyui_manager.py            # ComfyUI subprocess lifecycle (is_installed, status, start, stop)
├── localforge-sidecar.spec           # PyInstaller build spec
└── tests/
    ├── conftest.py                   # TestClient fixture, tmp engine_dir fixture
    ├── test_health.py                # health endpoint tests
    ├── test_engine.py                # engine endpoint tests
    └── test_integration.py           # start real sidecar subprocess, read port, call /health

src/main/
├── sidecar.ts                        # NEW: spawn sidecar, read PORT, expose getSidecarPort/Status/stop
└── ipc.ts                            # MODIFY: add sidecar:getStatus handler

src/preload/index.ts                  # MODIFY: add window.localforge.sidecar.getStatus()

tests/main/
└── sidecar.test.ts                   # MODIFY: integration test — spawn Python sidecar, verify port + health
```

---

### Task 1: Python Project Setup

**Files:**
- Create: `sidecar/pyproject.toml`
- Create: `sidecar/app.py`
- Create: `sidecar/routers/__init__.py`
- Create: `sidecar/services/__init__.py`
- Create: `sidecar/tests/conftest.py`

- [ ] **Step 1: Create `sidecar/pyproject.toml`**

```toml
[project]
name = "localforge-sidecar"
version = "1.0.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.34",
    "httpx>=0.28",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3",
    "pytest-asyncio>=0.25",
    "httpx>=0.28",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 2: Install dependencies**

```bash
cd sidecar
pip install uv
uv pip install -e ".[dev]"
```

Expected: packages installed, no errors.

- [ ] **Step 3: Create `sidecar/app.py`**

```python
import os
from fastapi import FastAPI
from services.comfyui_manager import ComfyUIManager


def create_app(engine_dir: str | None = None) -> FastAPI:
    if engine_dir is None:
        engine_dir = os.path.join(os.environ.get('APPDATA', ''), 'LocalForge', 'engine')

    app = FastAPI(title='LocalForge Sidecar', version='1.0.0')
    app.state.engine_dir = engine_dir
    app.state.manager = ComfyUIManager(engine_dir)

    from routers import health, engine
    app.include_router(health.router)
    app.include_router(engine.router, prefix='/engine')

    return app
```

- [ ] **Step 4: Create empty `sidecar/routers/__init__.py` and `sidecar/services/__init__.py`**

Both files are empty — they just mark the directories as Python packages.

- [ ] **Step 5: Create `sidecar/tests/conftest.py`**

```python
import os
import pytest
from fastapi.testclient import TestClient
from app import create_app


@pytest.fixture
def engine_dir(tmp_path) -> str:
    return str(tmp_path / 'engine')


@pytest.fixture
def client(engine_dir) -> TestClient:
    app = create_app(engine_dir=engine_dir)
    return TestClient(app)
```

- [ ] **Step 6: Verify pytest discovers the conftest**

```bash
cd sidecar
python -m pytest --collect-only
```

Expected: `0 tests collected` (no test files yet). No import errors.

- [ ] **Step 7: Commit**

```bash
cd sidecar
git add pyproject.toml app.py routers/__init__.py services/__init__.py tests/conftest.py
git commit -m "feat: add Python sidecar project setup with FastAPI app factory"
```

---

### Task 2: Health Endpoint

**Files:**
- Create: `sidecar/routers/health.py`
- Create: `sidecar/tests/test_health.py`

- [ ] **Step 1: Write the failing test at `sidecar/tests/test_health.py`**

```python
def test_health_returns_200(client):
    response = client.get('/health')
    assert response.status_code == 200


def test_health_returns_running_status(client):
    response = client.get('/health')
    data = response.json()
    assert data['status'] == 'running'
    assert data['version'] == '1.0.0'
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd sidecar
python -m pytest tests/test_health.py -v
```

Expected: FAIL — `404 Not Found` (route not registered yet).

- [ ] **Step 3: Create `sidecar/routers/health.py`**

```python
from fastapi import APIRouter

router = APIRouter()


@router.get('/health')
def health() -> dict:
    return {'status': 'running', 'version': '1.0.0'}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd sidecar
python -m pytest tests/test_health.py -v
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add sidecar/routers/health.py sidecar/tests/test_health.py
git commit -m "feat: add sidecar health endpoint"
```

---

### Task 3: ComfyUI Manager Service

**Files:**
- Create: `sidecar/services/comfyui_manager.py`
- Create: `sidecar/tests/test_comfyui_manager.py`

- [ ] **Step 1: Write the failing test at `sidecar/tests/test_comfyui_manager.py`**

```python
import os
import pytest
from services.comfyui_manager import ComfyUIManager


@pytest.fixture
def manager(tmp_path) -> ComfyUIManager:
    return ComfyUIManager(engine_dir=str(tmp_path))


def test_not_installed_when_comfyui_dir_missing(manager):
    assert manager.is_installed() is False


def test_status_is_not_installed_when_missing(manager):
    assert manager.get_status() == 'not_installed'


def test_installed_when_comfyui_dir_exists(manager, tmp_path):
    comfyui_dir = tmp_path / 'ComfyUI'
    comfyui_dir.mkdir()
    assert manager.is_installed() is True


def test_status_is_stopped_when_installed_but_not_running(manager, tmp_path):
    (tmp_path / 'ComfyUI').mkdir()
    assert manager.get_status() == 'stopped'


def test_stop_is_safe_when_not_running(manager):
    manager.stop()  # should not raise
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd sidecar
python -m pytest tests/test_comfyui_manager.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'services.comfyui_manager'`.

- [ ] **Step 3: Create `sidecar/services/comfyui_manager.py`**

```python
import os
import subprocess
from typing import Optional


class ComfyUIManager:
    COMFYUI_PORT = 8188

    def __init__(self, engine_dir: str) -> None:
        self.engine_dir = engine_dir
        self.comfyui_path = os.path.join(engine_dir, 'ComfyUI')
        self._process: Optional[subprocess.Popen] = None

    def is_installed(self) -> bool:
        return os.path.isdir(self.comfyui_path)

    def get_status(self) -> str:
        if not self.is_installed():
            return 'not_installed'
        if self._process is None:
            return 'stopped'
        if self._process.poll() is not None:
            self._process = None
            return 'error'
        return 'running'

    def start(self) -> bool:
        if not self.is_installed():
            return False
        if self._process and self._process.poll() is None:
            return True
        python = os.path.join(self.comfyui_path, 'venv', 'Scripts', 'python.exe')
        if not os.path.isfile(python):
            python = 'python'
        main_script = os.path.join(self.comfyui_path, 'main.py')
        self._process = subprocess.Popen(
            [python, main_script, '--listen', '127.0.0.1',
             '--port', str(self.COMFYUI_PORT), '--disable-auto-launch'],
            cwd=self.comfyui_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        return True

    def stop(self) -> None:
        if self._process:
            self._process.terminate()
            try:
                self._process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self._process.kill()
            self._process = None
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd sidecar
python -m pytest tests/test_comfyui_manager.py -v
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add sidecar/services/comfyui_manager.py sidecar/tests/test_comfyui_manager.py
git commit -m "feat: add ComfyUI manager service with status/start/stop"
```

---

### Task 4: Engine Status and Control Endpoints

**Files:**
- Create: `sidecar/routers/engine.py`
- Create: `sidecar/tests/test_engine.py`

- [ ] **Step 1: Write the failing test at `sidecar/tests/test_engine.py`**

```python
def test_engine_status_not_installed(client):
    response = client.get('/engine/status')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'not_installed'


def test_engine_start_returns_error_when_not_installed(client):
    response = client.post('/engine/start')
    assert response.status_code == 409
    data = response.json()
    assert 'not installed' in data['detail'].lower()


def test_engine_stop_is_safe_when_not_running(client):
    response = client.post('/engine/stop')
    assert response.status_code == 200


def test_engine_status_stopped_when_installed(client, engine_dir):
    import os
    os.makedirs(os.path.join(engine_dir, 'ComfyUI'), exist_ok=True)
    response = client.get('/engine/status')
    assert response.json()['status'] == 'stopped'
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd sidecar
python -m pytest tests/test_engine.py -v
```

Expected: FAIL — `404 Not Found` (routes not registered).

- [ ] **Step 3: Create `sidecar/routers/engine.py`**

```python
from fastapi import APIRouter, HTTPException, Request
from services.comfyui_manager import ComfyUIManager

router = APIRouter()


def _manager(request: Request) -> ComfyUIManager:
    return request.app.state.manager


@router.get('/status')
def engine_status(request: Request) -> dict:
    return {'status': _manager(request).get_status()}


@router.post('/start')
def engine_start(request: Request) -> dict:
    manager = _manager(request)
    if not manager.is_installed():
        raise HTTPException(status_code=409, detail='ComfyUI is not installed')
    manager.start()
    return {'status': manager.get_status()}


@router.post('/stop')
def engine_stop(request: Request) -> dict:
    _manager(request).stop()
    return {'status': 'stopped'}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd sidecar
python -m pytest tests/test_engine.py -v
```

Expected: PASS (4 tests).

- [ ] **Step 5: Run all sidecar tests**

```bash
cd sidecar
python -m pytest -v
```

Expected: PASS (11 tests total).

- [ ] **Step 6: Commit**

```bash
git add sidecar/routers/engine.py sidecar/tests/test_engine.py
git commit -m "feat: add engine status/start/stop endpoints"
```

---

### Task 5: Port Negotiation + Entry Point

**Files:**
- Create: `sidecar/main.py`
- Create: `sidecar/tests/test_integration.py`

- [ ] **Step 1: Create `sidecar/main.py`**

```python
import os
import socket
import sys

import uvicorn

from app import create_app


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]


if __name__ == '__main__':
    engine_dir = os.path.join(os.environ.get('APPDATA', ''), 'LocalForge', 'engine')
    port = find_free_port()
    print(f'PORT={port}', flush=True)
    sys.stdout.flush()
    uvicorn.run(
        create_app(engine_dir),
        host='127.0.0.1',
        port=port,
        log_level='warning',
    )
```

- [ ] **Step 2: Write the failing integration test at `sidecar/tests/test_integration.py`**

```python
import re
import subprocess
import sys
import time

import httpx
import pytest


@pytest.fixture
def running_sidecar():
    proc = subprocess.Popen(
        [sys.executable, 'main.py'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd='.',
    )
    port = None
    deadline = time.time() + 10
    while time.time() < deadline:
        line = proc.stdout.readline()
        match = re.search(r'PORT=(\d+)', line)
        if match:
            port = int(match.group(1))
            break
    if port is None:
        proc.kill()
        pytest.fail('Sidecar did not report PORT within 10 seconds')
    time.sleep(0.5)
    yield port
    proc.terminate()
    proc.wait(timeout=5)


def test_sidecar_reports_port_and_serves_health(running_sidecar):
    port = running_sidecar
    response = httpx.get(f'http://127.0.0.1:{port}/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'running'


def test_sidecar_engine_status_not_installed(running_sidecar):
    port = running_sidecar
    response = httpx.get(f'http://127.0.0.1:{port}/engine/status')
    assert response.status_code == 200
    assert response.json()['status'] == 'not_installed'
```

- [ ] **Step 3: Run integration test to verify it fails**

```bash
cd sidecar
python -m pytest tests/test_integration.py -v
```

Expected: FAIL — `main.py` doesn't exist yet (created in Step 1 but routers may have import issues). If the test starts the sidecar but can't reach it, it will fail with a connection error.

- [ ] **Step 4: Run integration test to verify it passes**

After creating `main.py` in Step 1 and verifying all routers exist:

```bash
cd sidecar
python -m pytest tests/test_integration.py -v
```

Expected: PASS (2 tests). Both sidecar instances start, report a port, and serve responses.

- [ ] **Step 5: Run all sidecar tests**

```bash
cd sidecar
python -m pytest -v
```

Expected: PASS (13 tests total: 2 health + 5 manager + 4 engine + 2 integration).

- [ ] **Step 6: Commit**

```bash
git add sidecar/main.py sidecar/tests/test_integration.py
git commit -m "feat: add sidecar entry point with port negotiation"
```

---

### Task 6: Electron Sidecar Spawner

**Files:**
- Create: `src/main/sidecar.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Create `src/main/sidecar.ts`**

```typescript
import { ChildProcess, spawn } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'

let sidecarProcess: ChildProcess | null = null
let sidecarPort: number | null = null

export type SidecarStatus = 'stopped' | 'starting' | 'running'

export function getSidecarPort(): number | null {
  return sidecarPort
}

export function getSidecarStatus(): SidecarStatus {
  if (!sidecarProcess) return 'stopped'
  if (sidecarPort === null) return 'starting'
  return 'running'
}

export function startSidecar(): Promise<number> {
  return new Promise((resolve, reject) => {
    const timeoutMs = 15_000
    let resolved = false

    const cmd = is.dev ? 'python' : join(process.resourcesPath, 'localforge-sidecar.exe')
    const args = is.dev ? [join(app.getAppPath(), 'sidecar', 'main.py')] : []

    sidecarProcess = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    sidecarProcess.stdout!.on('data', (data: Buffer) => {
      const match = data.toString().match(/PORT=(\d+)/)
      if (match && !resolved) {
        resolved = true
        sidecarPort = parseInt(match[1], 10)
        resolve(sidecarPort)
      }
    })

    sidecarProcess.on('error', (err) => {
      if (!resolved) { resolved = true; reject(err) }
    })

    sidecarProcess.on('exit', (code) => {
      sidecarPort = null
      if (!resolved) {
        resolved = true
        reject(new Error(`Sidecar exited with code ${code} before reporting port`))
      }
    })

    setTimeout(() => {
      if (!resolved) {
        resolved = true
        reject(new Error(`Sidecar port timeout after ${timeoutMs}ms`))
      }
    }, timeoutMs)
  })
}

export function stopSidecar(): void {
  if (sidecarProcess) {
    sidecarProcess.kill('SIGTERM')
    sidecarProcess = null
    sidecarPort = null
  }
}
```

- [ ] **Step 2: Modify `src/main/index.ts` to start the sidecar**

Read the current file. Add the sidecar import and start call. The updated `app.whenReady()` block should be:

```typescript
import { startSidecar, stopSidecar } from './sidecar'

// Inside app.whenReady().then(() => { ... }):
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.localforge.app')
  app.on('browser-window-created', (_, win) => optimizer.watchShortcuts(win))

  const dbPath = join(app.getPath('userData'), 'localforge.db')
  initDatabase(dbPath)
  registerIpcHandlers()

  // Start sidecar (non-blocking — window opens while sidecar starts)
  startSidecar().catch((err) => {
    console.error('Sidecar failed to start:', err)
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopSidecar()
  if (process.platform !== 'darwin') app.quit()
})
```

Note: `app.whenReady().then()` must become `async` because we call `startSidecar()` (though it's fire-and-forget, the async keyword is required for the `await` syntax if you use it later).

- [ ] **Step 3: Run Electron tests to confirm nothing broke**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
npm run test
```

Expected: 13/13 PASS (sidecar.ts is not tested by Vitest — it spawns real processes).

- [ ] **Step 4: Manual smoke test in dev mode**

```bash
npm run dev
```

Open DevTools (Ctrl+Shift+I). In the Console tab, run:
```javascript
window.localforge.sidecar.getStatus()
```

Expected: `Promise { <state>: "fulfilled", <value>: { status: "starting" | "running", port: <number> } }`

If `sidecar.getStatus` isn't on `window.localforge` yet, that's expected — IPC wiring is Task 7. For now, check the Electron main process terminal output: you should see no `Sidecar failed to start:` errors, and after ~2 seconds the port should be logged.

Add a temporary debug line to `startSidecar()` (remove after confirming):
```typescript
// In startSidecar, after sidecarPort = parseInt(...)
console.log(`[sidecar] started on port ${sidecarPort}`)
```

- [ ] **Step 5: Commit**

```bash
git add src/main/sidecar.ts src/main/index.ts
git commit -m "feat: spawn Python sidecar from Electron main process"
```

---

### Task 7: IPC and Preload for Sidecar Status

**Files:**
- Modify: `src/main/ipc.ts`
- Modify: `src/preload/index.ts`
- Modify: `tests/renderer/App.test.tsx` (no change needed — just verify tests still pass)

- [ ] **Step 1: Read `src/main/ipc.ts` and add the sidecar handler**

The updated `src/main/ipc.ts`:

```typescript
import { ipcMain } from 'electron'
import { getDatabase } from './database'
import { getSidecarPort, getSidecarStatus } from './sidecar'

export function registerIpcHandlers(): void {
  ipcMain.handle('db:getAllGenerations', () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM generations ORDER BY created_at DESC').all()
  })

  ipcMain.handle('sidecar:getStatus', () => {
    return {
      status: getSidecarStatus(),
      port: getSidecarPort(),
    }
  })
}
```

- [ ] **Step 2: Read `src/preload/index.ts` and add the sidecar API**

The updated `src/preload/index.ts`:

```typescript
import { contextBridge, ipcRenderer } from 'electron'

export const api = {
  db: {
    getAllGenerations: () => ipcRenderer.invoke('db:getAllGenerations'),
  },
  sidecar: {
    getStatus: () => ipcRenderer.invoke('sidecar:getStatus'),
  },
}

contextBridge.exposeInMainWorld('localforge', api)

declare global {
  interface Window {
    localforge: typeof api
  }
}
```

- [ ] **Step 3: Run all tests to confirm nothing broke**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
npm run test
```

Expected: 13/13 PASS.

- [ ] **Step 4: Manual verification in dev mode**

```bash
npm run dev
```

Open DevTools → Console:
```javascript
window.localforge.sidecar.getStatus().then(console.log)
```

Expected output (after ~2s for sidecar to start):
```
{ status: 'running', port: <number> }
```

Or immediately:
```
{ status: 'starting', port: null }
```

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc.ts src/preload/index.ts
git commit -m "feat: add sidecar:getStatus IPC handler and preload bridge"
```

---

### Task 8: PyInstaller Spec

**Files:**
- Create: `sidecar/localforge-sidecar.spec`
- Create: `sidecar/build.bat`

This task creates the PyInstaller build configuration. The actual frozen `.exe` is not built in CI — it's a manual release step. No tests for this task.

- [ ] **Step 1: Create `sidecar/localforge-sidecar.spec`**

```python
# localforge-sidecar.spec
# PyInstaller spec for the LocalForge sidecar process.
# Run: pyinstaller localforge-sidecar.spec
# Output: dist/localforge-sidecar.exe

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'anyio',
        'anyio._backends._asyncio',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='localforge-sidecar',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
```

- [ ] **Step 2: Create `sidecar/build.bat`**

```batch
@echo off
echo Building LocalForge sidecar...
pip install pyinstaller
pyinstaller localforge-sidecar.spec --clean
echo.
echo Done. Output: sidecar\dist\localforge-sidecar.exe
```

- [ ] **Step 3: Commit**

```bash
git add sidecar/localforge-sidecar.spec sidecar/build.bat
git commit -m "chore: add PyInstaller spec and build script for sidecar"
```

---

## Verification

Plan 2 is complete when:

- [ ] `cd sidecar && python -m pytest -v` → 13/13 PASS (2 health + 5 manager + 4 engine + 2 integration)
- [ ] `npm run test` → 13/13 PASS (all Plan 1 tests still passing)
- [ ] `npm run dev` → Electron opens, DevTools console shows `window.localforge.sidecar.getStatus()` returns `{ status: 'running', port: <number> }` after ~2s
- [ ] No orphaned `python` processes remain in Task Manager after closing the app

---

## Next Plans

| Plan | Feature | Depends on |
|---|---|---|
| Plan 3 | Setup wizard (hardware check, ComfyUI download) | Plans 1, 2 |
| Plan 4 | Generate screen (prompt builder, image output, progress) | Plans 1, 2, 3 |
| Plan 5 | Models screen (install/manage) | Plans 1, 2 |
| Plan 6 | Library screen | Plans 1, 4 |
| Plan 7 | Settings screen | Plans 1, 2 |
| Plan 8 | Packaging (Electron Builder, NSIS, PyInstaller) | All |
