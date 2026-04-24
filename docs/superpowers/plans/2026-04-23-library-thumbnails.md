# Library Thumbnail Image Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display output images as thumbnails in the Library grid and modal by serving them via the sidecar HTTP endpoint instead of broken `file:///` URLs.

**Architecture:** `Library.tsx` fetches the sidecar port on mount via `window.localforge.sidecar.getStatus()`, stores it in local state, and uses it to construct `http://127.0.0.1:{port}/output/{filename}` URLs. The sidecar's existing `GET /output/{filename}` endpoint already serves these files. No other files are touched.

**Tech Stack:** React, TypeScript, Zustand, Electron (renderer), existing FastAPI sidecar

---

### Task 1: Fix Library image URLs to serve via sidecar HTTP

**Files:**
- Modify: `src/renderer/src/screens/Library.tsx`

**Context:** The file currently has `toFileUrl()` and `imgSrc()` helpers that build `file:///` URLs. These are blocked in the Electron renderer when loaded from the Vite dev server. The sidecar already exposes `GET /output/{filename}`. `window.localforge.sidecar.getStatus()` returns `{ status, port }`.

- [ ] **Step 1: Add port state and fetch it on mount**

In `src/renderer/src/screens/Library.tsx`, replace the existing `useEffect` and add `port` state. The existing effect only loads generations — extend it to also fetch the port:

```tsx
// replace the existing useState import line (line 1) — add useState if not already imported
import { useEffect, useState } from 'react'

// inside the Library() component, add after the existing useState<string | null>:
const [port, setPort] = useState<number | null>(null)

// replace the existing useEffect:
useEffect(() => {
  window.localforge.sidecar.getStatus().then((s: { port: number }) => setPort(s.port))
  window.localforge.db.getAllGenerations().then((records: GenerationRecord[]) => {
    setGenerations(records)
  })
}, [setGenerations])
```

- [ ] **Step 2: Replace URL helpers with a single HTTP URL builder**

Delete `toFileUrl` and `imgSrc` (lines 6–16) and replace with:

```tsx
const outputUrl = (outputPath: string, p: number | null): string => {
  if (!p || !outputPath) return ''
  const filename = outputPath.split(/[\\/]/).pop() ?? ''
  return `http://127.0.0.1:${p}/output/${encodeURIComponent(filename)}`
}
```

- [ ] **Step 3: Update all image src attributes**

There are two `<img>` tags in the file:

1. Grid card (around line 69) — change:
```tsx
// before:
src={imgSrc(record)}
// after:
src={outputUrl(record.output_path, port)}
```

2. Modal (around line 126) — change:
```tsx
// before:
src={toFileUrl(selected.output_path)}
// after:
src={outputUrl(selected.output_path, port)}
```

- [ ] **Step 4: Verify the app renders thumbnails**

Start the app (`npm run dev` in the project root). Navigate to Library. If generations exist, images should appear in the grid cards. Click a card — the modal should show the full image.

Open DevTools (F12) → Network tab. Confirm requests go to `http://127.0.0.1:{port}/output/localforge_XXXXX_.png` and return 200.

If no generations exist, run a generation from the Generate screen first, then return to Library.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/screens/Library.tsx
git commit -m "feat: display library thumbnails via sidecar HTTP endpoint"
```
