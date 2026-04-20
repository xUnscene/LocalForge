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
  downloading_lumina: 'Downloading LuminaWrapper...',
  extracting_lumina: 'Extracting LuminaWrapper...',
  complete: 'Complete!',
  error: 'Error',
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<WizardStep>('welcome')
  const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null)
  const [progress, setProgress] = useState<InstallProgress>({ phase: 'idle', percent: 0, error: null })
  const [sidecarPort, setSidecarPort] = useState<number | null>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    window.localforge.sidecar.getStatus().then((s: { port: number | null }) => {
      setSidecarPort(s.port)
    })
    return () => { esRef.current?.close() }
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
    // Fetch GPU info using current sidecarPort state, or re-fetch the port if not yet set
    if (sidecarPort) {
      fetchGpuInfo(sidecarPort)
    } else {
      window.localforge.sidecar.getStatus().then((s: { port: number | null }) => {
        if (s.port) { setSidecarPort(s.port); fetchGpuInfo(s.port) }
      })
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
    const es = new EventSource(`http://127.0.0.1:${sidecarPort}/setup/progress`)
    esRef.current = es
    es.onmessage = (e) => {
      const p: InstallProgress = JSON.parse(e.data)
      setProgress(p)
      if (p.phase === 'complete') {
        es.close()
        setStep('ready')
      } else if (p.phase === 'error') {
        es.close()
      }
    }
  }

  const cardStyle: React.CSSProperties = {
    width: 520,
    background: 'var(--color-surface)',
    borderRadius: 12,
    padding: 40,
    border: '1px solid var(--color-border)',
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
              — it takes about 2 minutes.
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
            <h2 style={{ marginBottom: 16 }}>Installing ComfyUI</h2>
            {progress.phase === 'idle' && (
              <div>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                  Downloads ComfyUI + LuminaWrapper (~800MB total).
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
