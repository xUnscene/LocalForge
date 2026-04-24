# Library Thumbnail Image Preview — Design Spec
**Date:** 2026-04-23

## Problem
The Library grid already renders `<img>` elements for each generation card, but they fail silently. The `imgSrc()` helper builds `file:///` URLs from `output_path`, which Electron blocks in the renderer when loaded from `http://localhost` (Vite dev server) — same cross-scheme issue fixed on the Generate screen.

## Solution
Serve output images via the existing sidecar `GET /output/{filename}` endpoint. Library.tsx fetches the sidecar port on mount and builds `http://127.0.0.1:{port}/output/{filename}` URLs.

## Scope
**One file changed: `src/renderer/src/screens/Library.tsx`**

No DB schema changes. No new IPC handlers. No new sidecar endpoints. `thumbnail_path` stays `''` and is ignored — `output_path` is the source of truth.

## Implementation

### Port state
```ts
const [port, setPort] = useState<number | null>(null)
```

### Mount effect (merged with existing generations load)
```ts
useEffect(() => {
  window.localforge.sidecar.getStatus().then((s) => setPort(s.port))
  window.localforge.db.getAllGenerations().then((records) => setGenerations(records))
}, [setGenerations])
```

### URL helper (replaces `toFileUrl` and `imgSrc`)
```ts
const outputUrl = (outputPath: string, port: number | null): string => {
  if (!port || !outputPath) return ''
  const filename = outputPath.split(/[\\/]/).pop() ?? ''
  return `http://127.0.0.1:${port}/output/${filename}`
}
```

### Usage
- Grid card `<img src={outputUrl(record.output_path, port)} />`
- Modal `<img src={outputUrl(selected.output_path, port)} />`

## What doesn't change
- `thumbnail_path` DB column — remains `''`, unused
- `saveRecord` in Generate.tsx — unchanged
- Sidecar `GET /output/{filename}` — already live from previous session
- CSP `img-src` — already allows `http://127.0.0.1:*` (fixed this session)

## Non-goals
- Dedicated thumbnail file generation (deferred — full-res CSS scaling is acceptable)
- Persisting the sidecar port across sessions (ephemeral by design)
