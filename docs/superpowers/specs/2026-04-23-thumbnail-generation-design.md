# Thumbnail Generation — Design Spec

**Date:** 2026-04-23
**Status:** Approved

## Problem

The Library screen currently loads full-resolution PNG images (typically 1024×1024+) for every grid card. With a large library this causes slow initial load and unnecessary bandwidth on the local loopback. The `thumbnail_path` DB column already exists but is never populated.

## Goal

Generate a 256px JPEG thumbnail for each image immediately after generation completes. Serve it from the sidecar. Use it in the Library grid; keep full resolution for the modal detail view.

---

## Architecture

### 1. Thumbnail storage

Thumbnails are stored in a `thumbnails/` directory that is a sibling of `ComfyUI/output/`:

```
<engine_dir>/
  ComfyUI/
    output/        ← full-res PNGs (existing)
    thumbnails/    ← 256px JPEGs (new)
```

Thumbnail filename: `<original_stem>_thumb.jpg`
Example: `ComfyUI_00001_.png` → `thumbnails/ComfyUI_00001__thumb.jpg`

### 2. Thumbnail generation (`generation_runner.py`)

After `output_path` is set in `_run()`, generate the thumbnail using Pillow:

- Resize to fit within 256×256 (preserve aspect ratio, `Image.LANCZOS`)
- Save as JPEG, quality 85
- Create `thumbnails/` dir if it doesn't exist
- Add `thumbnail_path: str | None = None` to `GenerationProgress`
- On success: set `thumbnail_path` to the absolute path of the JPEG
- On failure: log the error, leave `thumbnail_path = None`, continue — generation still completes normally

Add `Pillow` to `sidecar/requirements.txt`. The sidecar runs in its own Python environment (Python 3.14), separate from the ComfyUI venv.

### 3. SSE event (`generate.py`)

The `complete` SSE event already carries `output_path`. Add `thumbnail_path` to the same payload:

```json
{ "status": "complete", "output_path": "...", "thumbnail_path": "...", "seed": 42, ... }
```

### 4. Thumbnail serving endpoint (`generate.py`)

New endpoint, same pattern as `/output/{filename}`:

```
GET /thumbnail/{filename}
```

Resolves path as `<output_dir>/../thumbnails/<basename(filename)>`. Returns 404 if not found.

### 5. Frontend — `Generate.tsx`

The SSE `complete` handler already calls `window.localforge.generate.saveRecord()`. Pass `thumbnail_path` from the event payload (empty string `''` if `null`).

### 6. Frontend — `Library.tsx`

Add a `thumbnailUrl()` helper:

```ts
const thumbnailUrl = (record: GenerationRecord, p: number | null): string => {
  if (p === null) return ''
  if (record.thumbnail_path) {
    const filename = record.thumbnail_path.split(/[\\/]/).pop() ?? ''
    return `http://127.0.0.1:${p}/thumbnail/${encodeURIComponent(filename)}`
  }
  return outputUrl(record.output_path, p)
}
```

- Grid `<img>`: use `thumbnailUrl()` — smaller file, faster grid load
- Modal `<img>`: keep `outputUrl()` — full resolution detail view

### 7. DB

No schema change needed. `thumbnail_path` column already exists. It will now be populated for new generations. Existing records keep `thumbnail_path = ''` and fall back to full-res via `thumbnailUrl()`'s fallback branch.

---

## Error handling

| Failure point | Behavior |
|---|---|
| Pillow not installed | Caught by `except Exception`, thumbnail_path stays None, generation completes |
| Output file missing at thumbnail time | Caught by `except Exception`, same as above |
| `/thumbnail/{filename}` 404 | Browser `onError` fires, `<img>` hidden — same as current behavior |

---

## Testing

- Unit test: `generation_runner.py` — mock Pillow, verify `thumbnail_path` is set on success and `None` on failure
- Unit test: `GET /thumbnail/{filename}` endpoint — 200 for existing file, 404 for missing
- Renderer test: `Library.tsx` — verify grid `<img>` uses `/thumbnail/` URL when `thumbnail_path` is set, falls back to `/output/` when empty

---

## Out of scope

- Backfilling thumbnails for existing library records
- Thumbnail size configurability
- WebP format
