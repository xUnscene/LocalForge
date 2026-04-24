import { useEffect, useState } from 'react'
import { useLibraryStore, GenerationRecord } from '../store/library.store'
import { useAppStore } from '../store/app.store'
import { useGenerateStore } from '../store/generate.store'

const formatDate = (ts: number): string =>
  new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

const outputUrl = (outputPath: string, p: number | null): string => {
  if (!p || !outputPath) return ''
  const filename = outputPath.split(/[\\/]/).pop() ?? ''
  return `http://127.0.0.1:${p}/output/${encodeURIComponent(filename)}`
}

export function Library() {
  const { generations, selectedId, setGenerations, selectGeneration } = useLibraryStore()
  const { navigate } = useAppStore()
  const { setSubject } = useGenerateStore()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [port, setPort] = useState<number | null>(null)

  useEffect(() => {
    window.localforge.sidecar.getStatus().then((s: { port: number }) => setPort(s.port))
    window.localforge.db.getAllGenerations().then((records: GenerationRecord[]) => {
      setGenerations(records)
    })
  }, [setGenerations])

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
                src={outputUrl(record.output_path, port)}
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
              src={outputUrl(selected.output_path, port)}
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
