# Thumbnail Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a 256px JPEG thumbnail for every image immediately after generation, serve it via the sidecar, and use it in the Library grid for faster loads.

**Architecture:** `GenerationRunner._run()` calls Pillow after the output image is ready, writes a JPEG to `<engine_dir>/ComfyUI/thumbnails/`, and stores the path in `GenerationProgress.thumbnail_path`. The `complete` SSE event carries `thumbnail_path` to the renderer, which saves it to the DB. The Library grid reads `thumbnail_path` from DB records and requests `GET /thumbnail/{filename}`; the modal keeps full resolution.

**Tech Stack:** Python Pillow (sidecar), FastAPI (sidecar endpoint), React/TypeScript (renderer)

---

## File Map

| File | Change |
|---|---|
| `sidecar/pyproject.toml` | Add `Pillow>=11.0` dependency |
| `sidecar/services/generation_runner.py` | Add `thumbnail_path` to `GenerationProgress`; add `_make_thumbnail()`; call it in `_run()` |
| `sidecar/routers/generate.py` | Add `thumbnail_path` to SSE payload; add `GET /thumbnail/{filename}` endpoint |
| `src/renderer/src/screens/Generate.tsx` | Pass `thumbnail_path` from SSE `complete` event to `saveRecord()` |
| `src/renderer/src/screens/Library.tsx` | Add `thumbnailUrl()` helper; use it for grid `<img>` |
| `sidecar/tests/test_generation_runner.py` | Add thumbnail tests |
| `sidecar/tests/test_generate_router.py` | Add SSE payload test and `/thumbnail/` endpoint tests |
| `tests/renderer/Generate.test.tsx` | Add test asserting `thumbnail_path` passed to `saveRecord()` |
| `tests/renderer/Library.test.tsx` | Add tests for thumbnail URL vs output URL fallback |

---

## Task 1: Add Pillow to sidecar dependencies

**Files:**
- Modify: `sidecar/pyproject.toml`

- [ ] **Step 1: Add Pillow to pyproject.toml**

In `sidecar/pyproject.toml`, update the `dependencies` array:

```toml
[project]
name = "localforge-sidecar"
version = "1.0.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.34",
    "httpx>=0.28",
    "Pillow>=11.0",
]
```

- [ ] **Step 2: Install the updated dependencies**

```bash
cd sidecar && pip install -e ".[dev]"
```

Expected: Pillow installs successfully, no errors.

- [ ] **Step 3: Verify Pillow import works**

```bash
cd sidecar && python -c "from PIL import Image; print('Pillow OK')"
```

Expected output: `Pillow OK`

- [ ] **Step 4: Commit**

```bash
git add sidecar/pyproject.toml
git commit -m "chore: add Pillow dependency to sidecar"
```

---

## Task 2: Thumbnail generation in GenerationRunner (TDD)

**Files:**
- Modify: `sidecar/services/generation_runner.py`
- Modify: `sidecar/tests/test_generation_runner.py`

- [ ] **Step 1: Write failing tests**

Add to `sidecar/tests/test_generation_runner.py` (after the existing imports and helpers):

```python
import os
from PIL import Image as PILImage


def test_make_thumbnail_creates_jpeg_in_thumbnails_dir(tmp_path):
    output_dir = tmp_path / 'output'
    output_dir.mkdir()
    img_path = output_dir / 'ComfyUI_00001_.png'
    PILImage.new('RGB', (1024, 1024), color=(128, 64, 32)).save(img_path)

    runner = GenerationRunner('http://127.0.0.1:8188', str(output_dir))
    thumb_path = runner._make_thumbnail(str(img_path))

    assert thumb_path is not None
    assert os.path.isfile(thumb_path)
    assert thumb_path.endswith('_thumb.jpg')
    with PILImage.open(thumb_path) as t:
        assert max(t.size) <= 256


def test_make_thumbnail_returns_none_on_missing_file(tmp_path):
    runner = GenerationRunner('http://127.0.0.1:8188', str(tmp_path / 'output'))
    result = runner._make_thumbnail('/nonexistent/does-not-exist.png')
    assert result is None


def test_runner_sets_thumbnail_path_on_completion(tmp_path):
    output_dir = tmp_path / 'output'
    output_dir.mkdir()
    img_path = output_dir / 'localforge_00001.png'
    PILImage.new('RGB', (512, 512)).save(img_path)

    prompt_id = 'pid-thumb'
    call_count = 0

    def mock_get(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return _make_mock_response({})
        return _make_mock_response({
            prompt_id: {'outputs': {'7': {'images': [{'filename': 'localforge_00001.png'}]}}}
        })

    with patch('httpx.post', return_value=_make_mock_response({'prompt_id': prompt_id})), \
         patch('httpx.get', side_effect=mock_get), \
         patch('time.sleep'):
        runner = GenerationRunner('http://127.0.0.1:8188', str(output_dir))
        runner.start({'5': {'inputs': {'steps': 20}}}, seed=42)
        runner._thread.join(timeout=5.0)

    p = runner.get_progress()
    assert p.status == 'complete'
    assert p.thumbnail_path is not None
    assert p.thumbnail_path.endswith('_thumb.jpg')
    assert os.path.isfile(p.thumbnail_path)
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd sidecar && pytest tests/test_generation_runner.py::test_make_thumbnail_creates_jpeg_in_thumbnails_dir tests/test_generation_runner.py::test_make_thumbnail_returns_none_on_missing_file tests/test_generation_runner.py::test_runner_sets_thumbnail_path_on_completion -v
```

Expected: 3 FAILED — `AttributeError: 'GenerationRunner' object has no attribute '_make_thumbnail'`

- [ ] **Step 3: Implement changes to generation_runner.py**

Replace the full content of `sidecar/services/generation_runner.py`:

```python
import os
import threading
import time
from dataclasses import dataclass, replace

import httpx
from PIL import Image


@dataclass
class GenerationProgress:
    status: str = 'idle'  # 'idle' | 'queued' | 'generating' | 'complete' | 'error'
    percent: int = 0
    seed: int = 0
    output_path: str | None = None
    thumbnail_path: str | None = None
    error: str | None = None


class GenerationRunner:
    def __init__(self, comfyui_url: str, output_dir: str) -> None:
        self.comfyui_url = comfyui_url
        self.output_dir = output_dir
        self._progress = GenerationProgress()
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None

    def get_progress(self) -> GenerationProgress:
        with self._lock:
            p = self._progress
            return replace(p)

    def start(self, workflow: dict, seed: int) -> str | None:
        """Start generation. Returns error string if already running, else None."""
        with self._lock:
            if self._thread and self._thread.is_alive():
                return 'Generation already in progress'
            self._progress = GenerationProgress(status='queued', seed=seed)
            self._thread = threading.Thread(target=self._run, args=(workflow, seed), daemon=True)
        self._thread.start()
        return None

    def _set(self, **kwargs) -> None:
        with self._lock:
            for k, v in kwargs.items():
                setattr(self._progress, k, v)

    def _make_thumbnail(self, output_path: str) -> str | None:
        try:
            thumb_dir = os.path.normpath(os.path.join(self.output_dir, '..', 'thumbnails'))
            os.makedirs(thumb_dir, exist_ok=True)
            stem = os.path.splitext(os.path.basename(output_path))[0]
            thumb_path = os.path.join(thumb_dir, f'{stem}_thumb.jpg')
            with Image.open(output_path) as img:
                img.thumbnail((256, 256), Image.LANCZOS)
                rgb = img.convert('RGB')
                rgb.save(thumb_path, 'JPEG', quality=85)
            return thumb_path
        except Exception:
            return None

    def _run(self, workflow: dict, seed: int) -> None:
        try:
            r = httpx.post(
                f'{self.comfyui_url}/prompt',
                json={'prompt': workflow, 'client_id': 'localforge'},
                timeout=10.0,
            )
            r.raise_for_status()
            prompt_id = r.json()['prompt_id']

            # Node '5' is the KSampler by convention in LocalForge workflows
            total = max(workflow.get('5', {}).get('inputs', {}).get('steps', 20), 1)
            step = 0

            while True:
                time.sleep(0.5)
                r = httpx.get(f'{self.comfyui_url}/history/{prompt_id}', timeout=5.0)
                r.raise_for_status()
                history = r.json()

                if prompt_id not in history:
                    step = min(step + 1, total - 1)
                    self._set(status='generating', percent=int(step / total * 100))
                    continue

                job = history[prompt_id]

                # Check for error
                status_str = job.get('status', {}).get('status_str', '')
                if status_str == 'error':
                    msgs = job.get('status', {}).get('messages', [])
                    if msgs:
                        last = msgs[-1]
                        # ComfyUI messages are [event_name, data] pairs
                        payload = last[1] if len(last) > 1 else last[0]
                        if isinstance(payload, dict):
                            error_msg = payload.get('exception_message') or payload.get('message') or str(payload)
                        else:
                            error_msg = str(payload)
                    else:
                        error_msg = 'Unknown ComfyUI error'
                    self._set(status='error', error=error_msg)
                    return

                # Check for outputs
                for node_output in job.get('outputs', {}).values():
                    images = node_output.get('images', [])
                    if images:
                        filename = images[0]['filename']
                        out_path = os.path.join(self.output_dir, filename)
                        thumb_path = self._make_thumbnail(out_path)
                        self._set(status='complete', percent=100, output_path=out_path,
                                  thumbnail_path=thumb_path)
                        return

                # Job in history but no outputs yet — keep polling
                step = min(step + 1, total - 1)
                self._set(status='generating', percent=int(step / total * 100))

        except Exception as e:
            self._set(status='error', error=str(e))
```

- [ ] **Step 4: Run all generation_runner tests to verify they pass**

```bash
cd sidecar && pytest tests/test_generation_runner.py -v
```

Expected: All 7 tests PASSED

- [ ] **Step 5: Commit**

```bash
git add sidecar/services/generation_runner.py sidecar/tests/test_generation_runner.py
git commit -m "feat: generate 256px JPEG thumbnail after image generation"
```

---

## Task 3: Add thumbnail_path to SSE payload and /thumbnail endpoint (TDD)

**Files:**
- Modify: `sidecar/routers/generate.py`
- Modify: `sidecar/tests/test_generate_router.py`

- [ ] **Step 1: Write failing tests**

Add to `sidecar/tests/test_generate_router.py`:

```python
import os
from PIL import Image as PILImage


def test_generate_sse_includes_thumbnail_path(engine_dir):
    app = create_app(engine_dir=engine_dir)
    mock_runner = MagicMock()
    mock_runner.start.return_value = None
    mock_runner.get_progress.return_value = GenerationProgress(
        status='complete', percent=100, seed=42,
        output_path='/out/test.png',
        thumbnail_path='/out/thumbnails/test_thumb.jpg',
    )
    app.state.runner = mock_runner

    client = TestClient(app)
    with client.stream('POST', '/generate', json={
        'subject': 'a cat', 'style': 'cinematic',
        'shot': {'camera': '', 'lens': '', 'lighting': '', 'ratio': '16:9'},
        'seed': 42,
    }) as r:
        content = r.read().decode()

    event = json.loads(content.split('data: ')[1].strip())
    assert event['thumbnail_path'] == '/out/thumbnails/test_thumb.jpg'


def test_get_thumbnail_returns_image_file(tmp_path):
    engine_dir = str(tmp_path / 'engine')
    app = create_app(engine_dir=engine_dir)
    thumb_dir = os.path.join(engine_dir, 'ComfyUI', 'thumbnails')
    os.makedirs(thumb_dir, exist_ok=True)
    thumb_path = os.path.join(thumb_dir, 'test_thumb.jpg')
    PILImage.new('RGB', (128, 128), color=(200, 100, 50)).save(thumb_path, 'JPEG')

    client = TestClient(app)
    r = client.get('/thumbnail/test_thumb.jpg')
    assert r.status_code == 200
    assert 'image' in r.headers['content-type']


def test_get_thumbnail_returns_404_for_missing_file(engine_dir):
    app = create_app(engine_dir=engine_dir)
    client = TestClient(app)
    r = client.get('/thumbnail/nonexistent_thumb.jpg')
    assert r.status_code == 404
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd sidecar && pytest tests/test_generate_router.py::test_generate_sse_includes_thumbnail_path tests/test_generate_router.py::test_get_thumbnail_returns_image_file tests/test_generate_router.py::test_get_thumbnail_returns_404_for_missing_file -v
```

Expected: 3 FAILED — `KeyError: 'thumbnail_path'` and `404` for thumbnail endpoint (not found because the route doesn't exist yet).

- [ ] **Step 3: Update generate.py**

Replace the full content of `sidecar/routers/generate.py`:

```python
import asyncio
import json
import os
import random

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse

from services.comfyui_manager import ComfyUIManager
from services.generation_runner import GenerationRunner
from services.prompt_assembler import assemble_prompt, build_workflow

router = APIRouter()

_COMFYUI_READY_TIMEOUT = 90


def _runner(request: Request) -> GenerationRunner:
    return request.app.state.runner


def _manager(request: Request) -> ComfyUIManager:
    return request.app.state.manager


@router.post('/generate')
async def generate(request: Request) -> StreamingResponse:
    body = await request.json()
    subject = body.get('subject', '')
    style = body.get('style', 'cinematic')
    shot = body.get('shot', {})
    seed = body.get('seed') or random.randint(0, 2 ** 32 - 1)
    raw_model = body.get('model', 'zimage.safetensors')
    checkpoint = request.app.state.model_manager.resolve_checkpoint_filename(raw_model)

    prompt = assemble_prompt(subject, style, shot)
    workflow = build_workflow(prompt, seed, shot.get('ratio', '16:9'), checkpoint)

    manager = _manager(request)
    runner = _runner(request)

    def _err(msg: str) -> str:
        return json.dumps({'status': 'error', 'percent': 0, 'seed': seed,
                           'output_path': None, 'thumbnail_path': None,
                           'error': msg, 'prompt': prompt})

    async def event_stream():
        if not manager.is_installed():
            yield f'data: {_err("ComfyUI is not installed — complete setup first")}\n\n'
            return

        # Auto-start ComfyUI and stream progress while waiting
        if manager.get_status() != 'running':
            manager.start()
            url = f'http://127.0.0.1:{ComfyUIManager.COMFYUI_PORT}/system_stats'
            deadline = asyncio.get_event_loop().time() + _COMFYUI_READY_TIMEOUT
            ready = False
            async with httpx.AsyncClient() as client:
                while asyncio.get_event_loop().time() < deadline:
                    yield f'data: {json.dumps({"status": "starting_engine", "percent": 0, "seed": seed, "output_path": None, "thumbnail_path": None, "error": None, "prompt": prompt})}\n\n'
                    try:
                        r = await client.get(url, timeout=2.0)
                        if r.status_code == 200:
                            ready = True
                            break
                    except Exception:
                        pass
                    await asyncio.sleep(2.0)

            if not ready:
                yield f'data: {_err(f"ComfyUI did not start within {_COMFYUI_READY_TIMEOUT}s — check sidecar.log")}\n\n'
                return

        start_err = runner.start(workflow, seed)
        if start_err:
            yield f'data: {_err(start_err)}\n\n'
            return

        while True:
            if await request.is_disconnected():
                break
            p = runner.get_progress()
            data = json.dumps({
                'status': p.status,
                'percent': p.percent,
                'seed': p.seed,
                'output_path': p.output_path,
                'thumbnail_path': p.thumbnail_path,
                'error': p.error,
                'prompt': prompt,
            })
            yield f'data: {data}\n\n'
            if p.status in ('complete', 'error'):
                break
            await asyncio.sleep(0.25)

    return StreamingResponse(event_stream(), media_type='text/event-stream')


@router.get('/output/{filename}')
async def get_output_image(filename: str, request: Request) -> FileResponse:
    output_dir = _runner(request).output_dir
    safe_path = os.path.join(output_dir, os.path.basename(filename))
    if not os.path.isfile(safe_path):
        raise HTTPException(status_code=404, detail='Image not found')
    return FileResponse(safe_path)


@router.get('/thumbnail/{filename}')
async def get_thumbnail(filename: str, request: Request) -> FileResponse:
    output_dir = _runner(request).output_dir
    thumb_dir = os.path.normpath(os.path.join(output_dir, '..', 'thumbnails'))
    safe_path = os.path.join(thumb_dir, os.path.basename(filename))
    if not os.path.isfile(safe_path):
        raise HTTPException(status_code=404, detail='Thumbnail not found')
    return FileResponse(safe_path)
```

- [ ] **Step 4: Run all generate router tests**

```bash
cd sidecar && pytest tests/test_generate_router.py -v
```

Expected: All 6 tests PASSED

- [ ] **Step 5: Commit**

```bash
git add sidecar/routers/generate.py sidecar/tests/test_generate_router.py
git commit -m "feat: add thumbnail_path to SSE payload and GET /thumbnail endpoint"
```

---

## Task 4: Pass thumbnail_path through Generate.tsx (TDD)

**Files:**
- Modify: `src/renderer/src/screens/Generate.tsx`
- Modify: `tests/renderer/Generate.test.tsx`

- [ ] **Step 1: Write failing test**

Add to the `describe('Generate', ...)` block in `tests/renderer/Generate.test.tsx`:

```tsx
it('passes thumbnail_path from SSE complete event to saveRecord', async () => {
  const sseBody =
    'data: {"status":"complete","percent":100,"seed":42,"output_path":"/out/img.png","thumbnail_path":"/out/thumbnails/img_thumb.jpg","error":null,"prompt":"a cat in rain"}\n\n'
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseBody))
      controller.close()
    },
  })
  vi.mocked(global.fetch).mockResolvedValue({ ok: true, body: readable } as any)
  vi.mocked(window.localforge.generate.saveRecord).mockResolvedValue({ success: true } as any)

  useGenerateStore.setState({ subject: 'a cat in rain' })
  render(<Generate />)
  fireEvent.click(screen.getByTestId('generate-btn'))

  await waitFor(() =>
    expect(window.localforge.generate.saveRecord).toHaveBeenCalledWith(
      expect.objectContaining({ thumbnail_path: '/out/thumbnails/img_thumb.jpg' })
    )
  )
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- --reporter=verbose tests/renderer/Generate.test.tsx
```

Expected: FAILED — `saveRecord` called with `thumbnail_path: ''` instead of the expected path.

- [ ] **Step 3: Update Generate.tsx**

In `src/renderer/src/screens/Generate.tsx`, find the `saveRecord` call (around line 123) and update the `thumbnail_path` field:

```tsx
await window.localforge.generate.saveRecord({
  id: crypto.randomUUID(),
  prompt: event.prompt ?? subject,
  seed: event.seed,
  model,
  output_path: event.output_path,
  thumbnail_path: event.thumbnail_path ?? '',
  created_at: Date.now(),
})
```

- [ ] **Step 4: Run Generate tests**

```bash
npm test -- --reporter=verbose tests/renderer/Generate.test.tsx
```

Expected: All 5 tests PASSED

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/screens/Generate.tsx tests/renderer/Generate.test.tsx
git commit -m "feat: pass thumbnail_path from SSE event to saveRecord"
```

---

## Task 5: Use thumbnail URL in Library grid (TDD)

**Files:**
- Modify: `src/renderer/src/screens/Library.tsx`
- Modify: `tests/renderer/Library.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to the `describe('Library', ...)` block in `tests/renderer/Library.test.tsx`:

```tsx
import { waitFor } from '@testing-library/react'

it('uses /thumbnail/ URL for grid image when thumbnail_path is set', async () => {
  const recordWithThumb = {
    ...MOCK_RECORD,
    thumbnail_path: 'C:\\engine\\ComfyUI\\thumbnails\\gen-1_thumb.jpg',
  }
  useLibraryStore.setState({ generations: [recordWithThumb] })
  vi.mocked(window.localforge.sidecar.getStatus).mockResolvedValue({ status: 'running', port: 8765 })
  render(<Library />)

  await waitFor(() => {
    const imgs = document.querySelectorAll('img')
    const gridImg = Array.from(imgs).find((img) => img.src.includes('/thumbnail/'))
    expect(gridImg).toBeDefined()
    expect(gridImg!.src).toContain('http://127.0.0.1:8765/thumbnail/')
  })
})

it('falls back to /output/ URL when thumbnail_path is empty', async () => {
  useLibraryStore.setState({ generations: [MOCK_RECORD] }) // thumbnail_path: ''
  vi.mocked(window.localforge.sidecar.getStatus).mockResolvedValue({ status: 'running', port: 8765 })
  render(<Library />)

  await waitFor(() => {
    const imgs = document.querySelectorAll('img')
    const gridImg = Array.from(imgs).find((img) => img.src.includes('/output/'))
    expect(gridImg).toBeDefined()
    expect(gridImg!.src).toContain('http://127.0.0.1:8765/output/')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- --reporter=verbose tests/renderer/Library.test.tsx
```

Expected: 2 FAILED — no `img` found with `/thumbnail/` path (grid uses `/output/` for everything currently).

- [ ] **Step 3: Update Library.tsx**

In `src/renderer/src/screens/Library.tsx`, add `thumbnailUrl()` after `outputUrl()` and update the grid `<img>` src:

```tsx
const thumbnailUrl = (record: GenerationRecord, p: number | null): string => {
  if (p === null || !record.output_path) return ''
  if (record.thumbnail_path) {
    const filename = record.thumbnail_path.split(/[\\/]/).pop() ?? ''
    return `http://127.0.0.1:${p}/thumbnail/${encodeURIComponent(filename)}`
  }
  return outputUrl(record.output_path, p)
}
```

Then update the grid `<img>` (inside the `generations.map(...)` block) — change:

```tsx
src={outputUrl(record.output_path, port)}
```

to:

```tsx
src={thumbnailUrl(record, port)}
```

The modal `<img>` (inside the `selected &&` block) keeps `outputUrl(selected.output_path, port)` unchanged — it always loads full resolution.

- [ ] **Step 4: Run all Library tests**

```bash
npm test -- --reporter=verbose tests/renderer/Library.test.tsx
```

Expected: All 7 tests PASSED

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: 18 test files, all passed.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/screens/Library.tsx tests/renderer/Library.test.tsx
git commit -m "feat: use thumbnail URL in Library grid, fall back to output URL"
```

---

## Task 6: Run full sidecar test suite

- [ ] **Step 1: Run all sidecar tests**

```bash
cd sidecar && pytest -v
```

Expected: All tests pass with no failures.

- [ ] **Step 2: If any pre-existing tests fail due to GenerationProgress changes**

The existing `test_runner_completes_generation` test does not assert `thumbnail_path`, so it should pass as-is. If it fails for another reason, check that `_make_thumbnail` handles missing files gracefully (returns `None`) — the test image file doesn't exist on disk, so `thumbnail_path` will be `None` after the run.

---

## Spec Coverage Check

| Spec section | Task |
|---|---|
| Thumbnail stored in `thumbnails/` sibling dir | Task 2 — `_make_thumbnail` path logic |
| 256×256 max size, LANCZOS resize, JPEG quality 85 | Task 2 — Pillow call |
| `thumbnail_path` in `GenerationProgress` | Task 2 |
| Pillow added to `sidecar/requirements.txt` / `pyproject.toml` | Task 1 |
| `thumbnail_path` in SSE `complete` event | Task 3 |
| `GET /thumbnail/{filename}` endpoint | Task 3 |
| `Generate.tsx` passes `thumbnail_path` to `saveRecord()` | Task 4 |
| Library grid uses thumbnail URL | Task 5 |
| Library modal keeps full-res URL | Task 5 — modal `<img>` unchanged |
| Fallback to `/output/` when `thumbnail_path` is empty | Task 5 — `thumbnailUrl()` fallback |
| Thumbnail failure does not fail generation | Task 2 — `except Exception: return None` |
