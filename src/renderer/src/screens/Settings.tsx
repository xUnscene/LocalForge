import { useEffect } from 'react'
import { useSettingsStore, ComfyStatus } from '../store/settings.store'

export function Settings() {
  const {
    gpuName, vramGb, comfyStatus, outputPath, appVersion, isRestarting,
    setGpuInfo, setComfyStatus, setOutputPath, setAppVersion, setIsRestarting,
  } = useSettingsStore()

  useEffect(() => {
    async function load() {
      const version = await window.localforge.app.getVersion()
      setAppVersion(version)

      const path = await window.localforge.settings.getOutputPath()
      setOutputPath(path)

      const { port } = await window.localforge.sidecar.getStatus()
      if (!port) return

      fetch(`http://127.0.0.1:${port}/setup/gpu-info`)
        .then((r) => r.json())
        .then((data) => {
          if (data.detected) setGpuInfo(data.name, data.vram_gb)
          else setGpuInfo('No GPU detected', null)
        })
        .catch(() => setGpuInfo('Detection failed', null))

      fetch(`http://127.0.0.1:${port}/engine/status`)
        .then((r) => r.json())
        .then((data) => setComfyStatus(data.status as ComfyStatus))
        .catch(() => setComfyStatus('error'))
    }
    load()
  }, [setGpuInfo, setComfyStatus, setOutputPath, setAppVersion])

  const handleRestart = async () => {
    const { port } = await window.localforge.sidecar.getStatus()
    if (!port) return
    setIsRestarting(true)
    try {
      await fetch(`http://127.0.0.1:${port}/engine/stop`, { method: 'POST' })
      await fetch(`http://127.0.0.1:${port}/engine/start`, { method: 'POST' })
      const res = await fetch(`http://127.0.0.1:${port}/engine/status`)
      const data = await res.json()
      setComfyStatus(data.status as ComfyStatus)
    } finally {
      setIsRestarting(false)
    }
  }

  const handleBrowse = async () => {
    const selected = await window.localforge.settings.browseOutputPath()
    if (selected) {
      await window.localforge.settings.setOutputPath(selected)
      setOutputPath(selected)
    }
  }

  const statusColor =
    comfyStatus === 'running' ? '#4ade80'
    : comfyStatus === 'error' ? '#f87171'
    : 'var(--color-text-secondary)'

  const section: React.CSSProperties = { marginBottom: 28 }
  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
  }
  const card: React.CSSProperties = {
    background: 'var(--color-surface)', borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)', padding: 16,
  }
  const fieldLabel: React.CSSProperties = {
    fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4,
  }
  const fieldValue: React.CSSProperties = {
    fontSize: 15, color: 'var(--color-text-primary)', fontWeight: 500,
  }
  const secondaryBtn: React.CSSProperties = {
    fontSize: 13, color: 'var(--color-text-primary)',
    background: 'var(--color-surface-raised)', padding: '8px 16px',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
  }

  return (
    <div data-testid="screen-settings" style={{ flex: 1, padding: 24, overflow: 'auto', maxWidth: 640 }}>
      <h1 style={{ color: 'var(--color-text-secondary)', fontWeight: 300, marginBottom: 32 }}>Settings</h1>

      {/* Hardware */}
      <section style={section}>
        <div style={sectionLabel}>Hardware</div>
        <div style={card}>
          <div style={fieldLabel}>GPU</div>
          <div style={fieldValue}>{gpuName ?? '—'}</div>
          {vramGb !== null && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              {vramGb} GB VRAM
            </div>
          )}
        </div>
      </section>

      {/* Engine */}
      <section style={section}>
        <div style={sectionLabel}>Engine</div>
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={fieldLabel}>ComfyUI</div>
            <div style={{ ...fieldValue, color: statusColor, textTransform: 'capitalize' }}>
              {comfyStatus ?? '—'}
            </div>
          </div>
          <button
            onClick={handleRestart}
            disabled={isRestarting}
            style={{ ...secondaryBtn, cursor: isRestarting ? 'not-allowed' : 'pointer', opacity: isRestarting ? 0.5 : 1 }}
          >
            {isRestarting ? 'Restarting…' : 'Restart Engine'}
          </button>
        </div>
      </section>

      {/* Output folder */}
      <section style={section}>
        <div style={sectionLabel}>Output</div>
        <div style={card}>
          <div style={{ ...fieldLabel, marginBottom: 8 }}>Output Folder</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              flex: 1, fontSize: 12, color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)', background: 'var(--color-bg)',
              padding: '8px 10px', borderRadius: 'var(--radius)',
              border: '1px solid var(--color-border)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {outputPath ?? '—'}
            </div>
            <button onClick={handleBrowse} style={{ ...secondaryBtn, flexShrink: 0 }}>
              Browse
            </button>
          </div>
        </div>
      </section>

      {/* About */}
      <section>
        <div style={sectionLabel}>About</div>
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={fieldLabel}>Version</div>
            <div style={{ ...fieldValue, fontFamily: 'var(--font-mono)' }}>
              {appVersion ?? '—'}
            </div>
          </div>
          <button
            onClick={() => window.localforge.app.openExternal('https://github.com/xUnscene/LocalForge/releases')}
            style={{ ...secondaryBtn, color: 'var(--color-accent)', background: 'transparent' }}
          >
            Check for updates
          </button>
        </div>
      </section>
    </div>
  )
}
