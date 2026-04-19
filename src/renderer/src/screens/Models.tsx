import { useState, useEffect, useRef } from 'react'
import { useModelsStore, ModelInfo } from '../store/models.store'

export function Models() {
  const {
    models, installStatus, installProgress, installError,
    setModels, setInstallStatus, markInstalled, markRemoved,
  } = useModelsStore()

  const [port, setPort] = useState<number | null>(null)
  const portRef = useRef<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const readerRefs = useRef<Record<string, ReadableStreamDefaultReader<Uint8Array>>>({})

  useEffect(() => {
    window.localforge.sidecar.getStatus().then((s: { port: number | null }) => {
      if (s.port) {
        portRef.current = s.port
        setPort(s.port)
        loadModels(s.port)
      }
    })
    return () => {
      Object.values(readerRefs.current).forEach((r) => r.cancel())
    }
  }, [])

  const loadModels = async (p: number) => {
    try {
      const r = await fetch(`http://127.0.0.1:${p}/models`)
      if (!r.ok) throw new Error(`Failed to load models: ${r.status}`)
      const data = await r.json()
      setModels(data.map((m: any) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        vramRequiredGb: m.vram_required_gb,
        downloadSizeGb: m.download_size_gb,
        installed: m.installed,
        sizeOnDiskGb: m.size_on_disk_gb,
        badge: m.badge,
      })))
    } catch (e) {
      setLoadError(String(e))
    }
  }

  const handleInstall = async (modelId: string) => {
    let activePort = portRef.current ?? port
    if (!activePort) {
      const s = await window.localforge.sidecar.getStatus()
      activePort = s.port
    }
    if (!activePort) return
    setInstallStatus(modelId, 'downloading', 0)
    try {
      const response = await fetch(`http://127.0.0.1:${activePort}/models/${modelId}/install`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error(`Install failed: ${response.status}`)

      const reader = response.body!.getReader()
      readerRefs.current[modelId] = reader
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()!

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const event = JSON.parse(line.slice(6))
          setInstallStatus(modelId, event.status, event.percent ?? 0, event.error ?? null)
          if (event.status === 'complete') {
            markInstalled(modelId)
          }
        }
      }
    } catch (e) {
      setInstallStatus(modelId, 'error', 0, String(e))
    }
  }

  const handleRemove = async (modelId: string) => {
    const activePort = portRef.current ?? port
    if (!activePort) return
    try {
      const r = await fetch(`http://127.0.0.1:${activePort}/models/${modelId}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(`Remove failed: ${r.status}`)
      markRemoved(modelId)
    } catch (e) {
      console.error('Remove failed:', e)
    }
  }

  const badgeColor = (badge: string) => {
    if (badge === 'Perfect for your GPU') return 'var(--color-accent)'
    if (badge === 'GPU required') return 'var(--color-text-secondary)'
    return '#EAB308'
  }

  return (
    <div data-testid="screen-models" style={{ flex: 1, padding: 24, overflow: 'auto' }}>
      <h1 style={{ color: 'var(--color-text-secondary)', fontWeight: 300, marginBottom: 24 }}>Models</h1>

      {loadError && (
        <div style={{ color: '#FCA5A5', marginBottom: 16, fontSize: 13 }}>{loadError}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
        {models.map((model: ModelInfo) => {
          const status = installStatus[model.id] ?? 'idle'
          const progress = installProgress[model.id] ?? 0
          const error = installError[model.id] ?? null
          const isDownloading = status === 'downloading'

          return (
            <div
              key={model.id}
              data-testid={`model-card-${model.id}`}
              style={{
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--color-border)',
                padding: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{model.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{model.description}</div>
                </div>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: 20,
                  border: `1px solid ${badgeColor(model.badge)}`,
                  color: badgeColor(model.badge),
                  whiteSpace: 'nowrap',
                  marginLeft: 16,
                  flexShrink: 0,
                }}>
                  {model.badge}
                </span>
              </div>

              {model.installed ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {model.sizeOnDiskGb !== null ? `${model.sizeOnDiskGb} GB on disk` : 'Installed'}
                  </span>
                  <button
                    data-testid={`remove-btn-${model.id}`}
                    onClick={() => handleRemove(model.id)}
                    style={{
                      fontSize: 12,
                      color: '#EF4444',
                      background: 'transparent',
                      padding: '3px 10px',
                      border: '1px solid #EF4444',
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isDownloading ? 8 : 0 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {model.downloadSizeGb} GB download
                    </span>
                    <button
                      data-testid={`install-btn-${model.id}`}
                      className="btn-primary"
                      onClick={() => handleInstall(model.id)}
                      disabled={isDownloading}
                      style={{ fontSize: 12, padding: '4px 14px' }}
                    >
                      {isDownloading ? `${progress}%` : 'Install'}
                    </button>
                  </div>

                  {isDownloading && (
                    <div style={{ background: 'var(--color-border)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--color-accent), var(--color-accent-light))',
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  )}

                  {status === 'error' && error && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#FCA5A5' }}>{error}</div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {models.length === 0 && !loadError && (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Loading models...</div>
        )}
      </div>
    </div>
  )
}
