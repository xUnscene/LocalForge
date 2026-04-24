import { useState, useEffect, useRef } from 'react'

type WizardStep = 'welcome' | 'hardware' | 'install' | 'ready'

interface GpuInfo {
  detected: boolean
  name: string | null
  vram_gb: number | null
  sufficient: boolean
}

interface InstallProgress {
  phase: string
  percent: number
  error: string | null
}

interface SetupWizardProps {
  onComplete: () => void
}

const PHASE_LABELS: Record<string, string> = {
  idle: 'Starting...',
  downloading_comfyui: 'Downloading ComfyUI...',
  extracting_comfyui: 'Extracting ComfyUI...',
  creating_venv: 'Creating Python environment...',
  installing_torch: 'Installing PyTorch (CUDA) — this may take a few minutes...',
  installing_comfyui_deps: 'Installing ComfyUI dependencies...',
  downloading_lumina: 'Downloading LuminaWrapper...',
  extracting_lumina: 'Extracting LuminaWrapper...',
  installing_lumina_deps: 'Installing LuminaWrapper dependencies...',
  complete: 'Complete!',
  error: 'Error',
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<WizardStep>('welcome')
  const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null)
  const [progress, setProgress] = useState<InstallProgress>({ phase: 'idle', percent: 0, error: null })
  const [sidecarPort, setSidecarPort] = useState<number | null>(null)
  const [engineDir, setEngineDir] = useState<string | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  useEffect(() => {
    window.localforge.sidecar.getStatus().then((s: { port: number | null }) => {
      setSidecarPort(s.port)
    })
    window.localforge.settings.getEngineDir().then(setEngineDir)
    return () => { readerRef.current?.cancel() }
  }, [])

  const fetchGpuInfo = async (port: number) => {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/setup/gpu-info`)
      setGpuInfo(await r.json())
    } catch {
      setGpuInfo({ detected: false, name: null, vram_gb: null, sufficient: false })
    }
  }

  const handleGetStarted = () => {
    setStep('hardware')
    if (sidecarPort) {
      fetchGpuInfo(sidecarPort)
    } else {
      window.localforge.sidecar.getStatus().then((s: { port: number | null }) => {
        if (s.port) { setSidecarPort(s.port); fetchGpuInfo(s.port) }
      })
    }
  }

  const handleBrowseLocation = async () => {
    const selected = await window.localforge.settings.browseEngineDir()
    if (selected) {
      await window.localforge.settings.setEngineDir(selected)
      setEngineDir(selected)
      // Sidecar restarts on engine dir change — refresh the port
      const s = await window.localforge.sidecar.getStatus()
      setSidecarPort(s.port)
    }
  }

  const startInstall = async () => {
    if (!sidecarPort) {
      setProgress({ phase: 'error', percent: 0, error: 'Sidecar not running — restart the app and try again.' })
      return
    }
    try {
      const r = await fetch(`http://127.0.0.1:${sidecarPort}/setup/install`, { method: 'POST' })
      if (!r.ok) throw new Error(`Install request failed: ${r.status}`)
    } catch (e) {
      setProgress({ phase: 'error', percent: 0, error: String(e) })
      return
    }
    try {
      const response = await fetch(`http://127.0.0.1:${sidecarPort}/setup/progress`)
      if (!response.ok || !response.body) throw new Error('Progress stream unavailable')
      const reader = response.body.getReader()
      readerRef.current = reader
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
          const p: InstallProgress = JSON.parse(line.slice(6))
          setProgress(p)
          if (p.phase === 'complete') { reader.cancel(); setStep('ready'); return }
          if (p.phase === 'error') { reader.cancel(); return }
        }
      }
    } catch (e) {
      setProgress({ phase: 'error', percent: 0, error: String(e) })
    }
  }

  const cardStyle: React.CSSProperties = {
    width: 520,
    background: 'var(--color-surface)',
    borderRadius: 12,
    padding: 40,
    border: '1px solid var(--color-border)',
  }

  const monoBox: React.CSSProperties = {
    flex: 1,
    fontSize: 12,
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-mono)',
    background: 'var(--color-bg)',
    padding: '8px 10px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  }

  return (
    <div
      data-testid="setup-wizard"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div style={cardStyle}>
        {step === 'welcome' && (
          <div data-testid="step-welcome">
            <h1 style={{ color: 'var(--color-accent)', marginBottom: 8, fontSize: 24 }}>
              Welcome to LocalForge
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              Your local AI image studio. We'll download ComfyUI and get everything ready
              — it takes about 10–20 minutes and ~5GB of disk space.
            </p>
            <button className="btn-primary" onClick={handleGetStarted}>
              Get Started
            </button>
          </div>
        )}

        {step === 'hardware' && (
          <div data-testid="step-hardware">
            <h2 style={{ marginBottom: 16 }}>Hardware Check</h2>
            {gpuInfo === null && (
              <p style={{ color: 'var(--color-text-secondary)' }}>Detecting GPU...</p>
            )}
            {gpuInfo !== null && !gpuInfo.detected && (
              <p style={{ color: '#F87171', marginBottom: 16 }}>
                No NVIDIA GPU detected. LocalForge requires an NVIDIA GPU with 8GB+ VRAM.
              </p>
            )}
            {gpuInfo !== null && gpuInfo.detected && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ color: 'var(--color-text-primary)', marginBottom: 8 }}>
                  GPU: <strong>{gpuInfo.name}</strong>
                </p>
                <p style={{ color: 'var(--color-text-primary)' }}>
                  VRAM: <strong>{gpuInfo.vram_gb} GB</strong>
                  {!gpuInfo.sufficient && (
                    <span style={{ color: '#F87171', marginLeft: 8 }}>
                      ⚠ 8GB+ recommended
                    </span>
                  )}
                </p>
              </div>
            )}
            {gpuInfo !== null && (
              <button className="btn-primary" onClick={() => setStep('install')}>
                Continue
              </button>
            )}
          </div>
        )}

        {step === 'install' && (
          <div data-testid="step-install">
            <h2 style={{ marginBottom: 16 }}>Install ComfyUI</h2>

            {progress.phase === 'idle' && (
              <div>
                {/* Install location picker */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                    Install location
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={monoBox}>{engineDir ?? '...'}</div>
                    <button
                      onClick={handleBrowseLocation}
                      style={{
                        fontSize: 12,
                        padding: '6px 14px',
                        background: 'transparent',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius)',
                        color: 'var(--color-text-secondary)',
                        flexShrink: 0,
                      }}
                    >
                      Browse
                    </button>
                  </div>
                </div>

                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16, fontSize: 13 }}>
                  Downloads ComfyUI + LuminaWrapper + PyTorch (CUDA). Requires ~5GB free space.
                </p>
                <button className="btn-primary" onClick={startInstall}>
                  Start Install
                </button>
              </div>
            )}

            {progress.phase !== 'idle' && progress.phase !== 'error' && (
              <div>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                  {PHASE_LABELS[progress.phase] ?? progress.phase}
                </p>
                <div
                  style={{
                    background: 'var(--color-border)',
                    borderRadius: 4,
                    height: 8,
                    overflow: 'hidden',
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      width: `${progress.percent}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--color-accent), var(--color-accent-light))',
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                  {progress.percent}%
                </p>
              </div>
            )}

            {progress.phase === 'error' && (
              <div>
                <p style={{ color: '#F87171', marginBottom: 12 }}>
                  Error: {progress.error}
                </p>
                <button
                  className="btn-primary"
                  onClick={() => setProgress({ phase: 'idle', percent: 0, error: null })}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'ready' && (
          <div data-testid="step-ready">
            <h2 style={{ color: 'var(--color-accent)', marginBottom: 8 }}>You're all set!</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              ComfyUI is installed. Head to the Models screen to download your first model.
            </p>
            <button className="btn-primary" onClick={onComplete}>
              Open LocalForge
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
