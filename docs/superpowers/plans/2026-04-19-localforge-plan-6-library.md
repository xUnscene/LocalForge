# LocalForge Plan 6: Library Screen

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A functional Library screen that displays past generations in a scrollable image grid with hover metadata overlay, and a click-to-open modal showing the full-size image, full metadata, and a Re-generate action.

**Architecture:** No sidecar changes needed — generation records are already persisted in SQLite (Plan 4) and exposed via `window.localforge.db.getAllGenerations()` IPC (Plan 1). The screen loads records on mount into a Zustand store, renders a CSS `auto-fill` grid of image cards with hover overlays, and manages a full-size modal via `selectedId` in the store. Re-generate pre-populates `useGenerateStore.setSubject()` with the stored assembled prompt and navigates to the Generate screen. Since `thumbnail_path` may be empty (Plan 4 didn't generate thumbnails), the screen falls back to `output_path` when `thumbnail_path` is falsy. All image paths are Windows backslash paths and must be converted to `file:///` URLs for `<img>` tags.

**Tech Stack:** React useState/useEffect | Zustand | CSS Grid | file:// URLs

---

## File Map

```
src/renderer/src/
├── store/
│   └── library.store.ts    # NEW: GenerationRecord type, generations list, selectedId
└── screens/
    └── Library.tsx         # MODIFY: replace stub with full implementation

tests/renderer/
├── library.store.test.ts   # NEW: 3 tests
└── Library.test.tsx        # NEW: 4 tests
```

---

### Task 1: Library Zustand Store

**Files:**
- Create: `src/renderer/src/store/library.store.ts`
- Create: `tests/renderer/library.store.test.ts`

- [ ] **Step 1: Write the failing test at `tests/renderer/library.store.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useLibraryStore } from '../../src/renderer/src/store/library.store'

const MOCK_RECORD = {
  id: 'gen-1',
  prompt: 'a woman walking through a neon-lit tokyo street, cinematic',
  seed: 12345,
  model: 'z-image',
  output_path: 'C:\\Users\\user\\AppData\\Roaming\\LocalForge\\outputs\\gen-1.png',
  thumbnail_path: '',
  created_at: 1713456789000,
}

describe('LibraryStore', () => {
  beforeEach(() => {
    useLibraryStore.setState({ generations: [], selectedId: null })
  })

  it('setGenerations populates the list', () => {
    useLibraryStore.getState().setGenerations([MOCK_RECORD])
    expect(useLibraryStore.getState().generations).toHaveLength(1)
    expect(useLibraryStore.getState().generations[0].id).toBe('gen-1')
  })

  it('selectGeneration sets selectedId', () => {
    useLibraryStore.getState().selectGeneration('gen-1')
    expect(useLibraryStore.getState().selectedId).toBe('gen-1')
  })

  it('selectGeneration with null clears selection', () => {
    useLibraryStore.getState().selectGeneration('gen-1')
    useLibraryStore.getState().selectGeneration(null)
    expect(useLibraryStore.getState().selectedId).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\Program Files\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\AI\Projects\SimpliGen\.worktrees\plan-6-library'; & 'C:\Program Files\nodejs\npm.cmd' run test -- tests/renderer/library.store.test.ts"
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `src/renderer/src/store/library.store.ts`**

```typescript
import { create } from 'zustand'

export interface GenerationRecord {
  id: string
  prompt: string
  seed: number
  model: string
  output_path: string
  thumbnail_path: string
  created_at: number
}

interface LibraryState {
  generations: GenerationRecord[]
  selectedId: string | null
  setGenerations: (records: GenerationRecord[]) => void
  selectGeneration: (id: string | null) => void
}

export const useLibraryStore = create<LibraryState>((set) => ({
  generations: [],
  selectedId: null,
  setGenerations: (generations) => set({ generations }),
  selectGeneration: (selectedId) => set({ selectedId }),
}))
```

- [ ] **Step 4: Run test to verify it passes**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\Program Files\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\AI\Projects\SimpliGen\.worktrees\plan-6-library'; & 'C:\Program Files\nodejs\npm.cmd' run test -- tests/renderer/library.store.test.ts"
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git -C "f:/AI/Projects/SimpliGen/.worktrees/plan-6-library" add src/renderer/src/store/library.store.ts tests/renderer/library.store.test.ts
git -C "f:/AI/Projects/SimpliGen/.worktrees/plan-6-library" commit -m "feat: add library Zustand store (generations list, selectedId)"
```

---

### Task 2: Library Screen

**Files:**
- Modify: `src/renderer/src/screens/Library.tsx` (replace stub with full implementation)
- Create: `tests/renderer/Library.test.tsx`

- [ ] **Step 1: Write the failing test at `tests/renderer/Library.test.tsx`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Library } from '../../src/renderer/src/screens/Library'
import { useLibraryStore } from '../../src/renderer/src/store/library.store'

const MOCK_RECORD = {
  id: 'gen-1',
  prompt: 'a woman walking through a neon-lit tokyo street, cinematic',
  seed: 12345,
  model: 'z-image',
  output_path: 'C:\\Users\\user\\AppData\\Roaming\\LocalForge\\outputs\\gen-1.png',
  thumbnail_path: '',
  created_at: 1713456789000,
}

describe('Library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLibraryStore.setState({ generations: [], selectedId: null })
    vi.mocked(window.localforge.db.getAllGenerations).mockResolvedValue([])
  })

  it('renders screen-library testid', () => {
    render(<Library />)
    expect(screen.getByTestId('screen-library')).toBeInTheDocument()
  })

  it('shows empty state when no generations', () => {
    render(<Library />)
    expect(screen.getByText(/no generations yet/i)).toBeInTheDocument()
  })

  it('renders a generation card when store has records', () => {
    useLibraryStore.setState({ generations: [MOCK_RECORD] })
    render(<Library />)
    expect(screen.getByTestId('gen-card-gen-1')).toBeInTheDocument()
  })

  it('clicking a card opens the modal with seed metadata', () => {
    useLibraryStore.setState({ generations: [MOCK_RECORD] })
    render(<Library />)
    fireEvent.click(screen.getByTestId('gen-card-gen-1'))
    expect(screen.getByTestId('generation-modal')).toBeInTheDocument()
    expect(screen.getByText('12345')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\Program Files\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\AI\Projects\SimpliGen\.worktrees\plan-6-library'; & 'C:\Program Files\nodejs\npm.cmd' run test -- tests/renderer/Library.test.tsx"
```

Expected: test for empty state fails (stub shows "Library" heading not empty state text), testid and card tests fail

- [ ] **Step 3: Read the existing `src/renderer/src/screens/Library.tsx` stub first, then replace it entirely with the full implementation below**

```tsx
import { useEffect, useState } from 'react'
import { useLibraryStore, GenerationRecord } from '../store/library.store'
import { useAppStore } from '../store/app.store'
import { useGenerateStore } from '../store/generate.store'

const toFileUrl = (path: string): string =>
  path ? `file:///${path.replace(/\\/g, '/')}` : ''

const formatDate = (ts: number): string =>
  new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

const imgSrc = (record: GenerationRecord): string =>
  record.thumbnail_path ? toFileUrl(record.thumbnail_path) : toFileUrl(record.output_path)

export function Library() {
  const { generations, selectedId, setGenerations, selectGeneration } = useLibraryStore()
  const { navigate } = useAppStore()
  const { setSubject } = useGenerateStore()
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    window.localforge.db.getAllGenerations().then((records: GenerationRecord[]) => {
      setGenerations(records)
    })
  }, [])

  const selected = generations.find((g) => g.id === selectedId) ?? null

  const handleRegenerate = (record: GenerationRecord) => {
    setSubject(record.prompt)
    selectGeneration(null)
    navigate('generate')
  }

  return (
    <div data-testid="screen-library" style={{ flex: 1, padding: 24, overflow: 'auto' }}>
      <h1 style={{ color: 'var(--color-text-secondary)', fontWeight: 300, marginBottom: 24 }}>Library</h1>

      {generations.length === 0 ? (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
          No generations yet — head to Generate to create your first image.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
        }}>
          {generations.map((record) => (
            <div
              key={record.id}
              data-testid={`gen-card-${record.id}`}
              onClick={() => selectGeneration(record.id)}
              onMouseEnter={() => setHoveredId(record.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                position: 'relative',
                cursor: 'pointer',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                aspectRatio: '1',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <img
                src={imgSrc(record)}
                alt={record.prompt.slice(0, 80)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 55%)',
                opacity: hoveredId === record.id ? 1 : 0,
                transition: 'opacity 0.2s',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: 10,
              }}>
                <div style={{ fontSize: 11, color: '#fff', fontWeight: 500, marginBottom: 2 }}>
                  {record.prompt.length > 60
                    ? `${record.prompt.slice(0, 60)}…`
                    : record.prompt}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                  {record.model} · {formatDate(record.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div
          data-testid="generation-modal"
          onClick={(e) => { if (e.target === e.currentTarget) selectGeneration(null) }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--color-border)',
            maxWidth: 900,
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <img
              src={toFileUrl(selected.output_path)}
              alt={selected.prompt.slice(0, 80)}
              style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', background: '#1a1a1a' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div style={{ padding: 20 }}>
              <div style={{
                fontSize: 13,
                color: 'var(--color-text-secondary)',
                marginBottom: 12,
                lineHeight: 1.6,
              }}>
                {selected.prompt}
              </div>
              <div style={{
                display: 'flex',
                gap: 20,
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                marginBottom: 16,
              }}>
                <span>
                  Seed:{' '}
                  <span style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {selected.seed}
                  </span>
                </span>
                <span>
                  Model:{' '}
                  <span style={{ color: 'var(--color-text-primary)' }}>{selected.model}</span>
                </span>
                <span>{formatDate(selected.created_at)}</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn-primary"
                  onClick={() => handleRegenerate(selected)}
                  style={{ fontSize: 13 }}
                >
                  Re-generate
                </button>
                <button
                  onClick={() => selectGeneration(null)}
                  style={{
                    fontSize: 13,
                    color: 'var(--color-text-secondary)',
                    background: 'transparent',
                    padding: '8px 16px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run Library screen tests**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\Program Files\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\AI\Projects\SimpliGen\.worktrees\plan-6-library'; & 'C:\Program Files\nodejs\npm.cmd' run test -- tests/renderer/Library.test.tsx"
```

Expected: PASS (4 tests)

- [ ] **Step 5: Run all Electron tests**

```
powershell -Command "[System.Environment]::SetEnvironmentVariable('PATH', 'C:\Program Files\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH', 'Process'), 'Process'); cd 'f:\AI\Projects\SimpliGen\.worktrees\plan-6-library'; & 'C:\Program Files\nodejs\npm.cmd' run test"
```

Expected: 45 passes (38 existing + 3 library store + 4 library screen). Report actual count if different.

- [ ] **Step 6: Run all sidecar tests to confirm no regressions**

```bash
cd "f:/AI/Projects/SimpliGen/.worktrees/plan-6-library/sidecar" && python -m pytest -v
```

Expected: 50 passes.

- [ ] **Step 7: Commit**

```bash
git -C "f:/AI/Projects/SimpliGen/.worktrees/plan-6-library" add src/renderer/src/screens/Library.tsx tests/renderer/Library.test.tsx
git -C "f:/AI/Projects/SimpliGen/.worktrees/plan-6-library" commit -m "feat: add Library screen (image grid, hover overlay, full-size modal, re-generate)"
```

---

## Verification

Plan 6 is complete when:

- [ ] `npm run test` → 45/45 PASS
- [ ] `cd sidecar && python -m pytest -v` → 50/50 PASS
- [ ] `npm run dev` → clicking Library nav icon shows empty-state message
- [ ] After generating an image (Plan 4 flow), Library shows the generation card
- [ ] Hovering a card shows the prompt snippet, model, and timestamp overlay
- [ ] Clicking a card opens the full-size modal
- [ ] Modal shows seed, model, timestamp, and full prompt
- [ ] "Re-generate" button navigates to Generate with the subject pre-filled
- [ ] Clicking outside the modal (on the backdrop) closes it
- [ ] "Close" button closes the modal

---

## Notes for Implementer

- **Python path**: Run all Python commands from `f:/AI/Projects/SimpliGen/.worktrees/plan-6-library/sidecar/`
- **Node path**: Run npm commands from `f:/AI/Projects/SimpliGen/.worktrees/plan-6-library/` with `C:\Program Files\nodejs` on PATH via PowerShell
- **`thumbnail_path` may be empty string**: Plan 4's Generate screen did not implement thumbnail generation. The `imgSrc()` helper falls back to `output_path` when `thumbnail_path` is falsy — this is intentional.
- **`toFileUrl()`**: Converts `C:\path\to\file.png` → `file:///C:/path/to/file.png`. Required for Electron `<img>` tags with contextIsolation enabled. Backslash replacement is essential.
- **`window.localforge.db.getAllGenerations`** is already stubbed in `tests/setup.ts` to return `[]`. Override it per-test with `vi.mocked(window.localforge.db.getAllGenerations).mockResolvedValue([MOCK_RECORD])` when you need data.
- **Re-generate flow**: `handleRegenerate` calls `useGenerateStore.setSubject(record.prompt)` (the full assembled prompt) and `useAppStore.navigate('generate')`. The Generate screen's subject textarea will be pre-filled with the prompt string. The individual Style and Shot fields are not restored — only subject is available from the stored record.
- **Modal backdrop click**: The `onClick` handler on the backdrop div checks `e.target === e.currentTarget` before closing — prevents clicks on the inner content card from propagating and closing the modal.

---

## Next Plans

| Plan | Feature | Depends on |
|---|---|---|
| Plan 7 | Settings screen (GPU readout, ComfyUI status, paths) | Plans 1, 2 |
| Plan 8 | Packaging (Electron Builder, NSIS, PyInstaller sidecar) | All |
