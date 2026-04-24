import { useState, useEffect, useRef } from 'react'
import { useGenerateStore, ShotSettings } from '../store/generate.store'

const STYLES = [
  { id: 'cinematic', label: 'Cinematic', desc: 'High contrast, film grain' },
  { id: 'studio_portrait', label: 'Studio Portrait', desc: 'Clean, professional' },
  { id: 'photojournalism', label: 'Photojournalism', desc: 'Natural, candid' },
  { id: 'fashion_editorial', label: 'Fashion Editorial', desc: 'Bold, magazine' },
  { id: 'street', label: 'Street', desc: 'Gritty, urban, candid' },
  { id: 'fine_art', label: 'Fine Art', desc: 'Painterly, artistic' },
  { id: 'commercial', label: 'Commercial', desc: 'Bright, clean' },
  { id: 'documentary', label: 'Documentary', desc: 'Raw, authentic' },
]

const SUBJECT_CHIPS = [
  'a woman in rain', 'city at night', 'forest path',
  'mountain peak', 'street market', 'portrait in window light',
]

const CAMERAS = ['Sony A7 IV', 'Canon EOS R5', 'Nikon Z8', 'Leica M11', 'iPhone 15 Pro']
const LENSES = ['35mm f/1.4', '50mm f/1.8', '85mm f/1.2', '24mm wide', '100mm macro']
const LIGHTINGS = ['Natural', 'Golden Hour', 'Studio Softbox', 'Chiaroscuro', 'Neon/Urban']
const RATIOS = ['16:9', '4:3', '1:1', '9:16', '3:2']

const SHOT_FIELDS: { field: keyof ShotSettings; label: string; options: string[] }[] = [
  { field: 'camera', label: 'Camera', options: CAMERAS },
  { field: 'lens', label: 'Lens', options: LENSES },
  { field: 'lighting', label: 'Lighting', options: LIGHTINGS },
  { field: 'ratio', label: 'Aspect Ratio', options: RATIOS },
]

export function Generate() {
  const {
    subject, style, shot, status, progress, seed, outputImagePath, lastError,
    setSubject, setStyle, setShotField, setGenerationResult, resetGeneration,
  } = useGenerateStore()

  const [openStep, setOpenStep] = useState<1 | 2 | 3>(1)
  const [port, setPort] = useState<number | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  useEffect(() => {
    window.localforge.sidecar.getStatus().then((s: { port: number | null }) => {
      setPort(s.port)
    })
    return () => { readerRef.current?.cancel() }
  }, [])

  const handleGenerate = async () => {
    if (status === 'generating' || status === 'queued') return
    resetGeneration()

    // Resolve port at call time in case state hasn't settled yet
    let activePort = port
    if (!activePort) {
      const s = await window.localforge.sidecar.getStatus()
      activePort = s.port
    }
    if (!activePort) {
      setGenerationResult({ status: 'error', lastError: 'Sidecar not running' })
      return
    }

    try {
      const response = await fetch(`http://127.0.0.1:${activePort}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, style, shot }),
      })

      if (!response.ok) throw new Error(`Sidecar error: ${response.status}`)

      const reader = response.body!.getReader()
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
          const event = JSON.parse(line.slice(6))
          setGenerationResult({
            status: event.status,
            progress: event.percent ?? 0,
            seed: event.seed ?? null,
            outputImagePath: event.output_path ?? null,
            lastError: event.error ?? null,
          })

          if (event.status === 'complete' && event.output_path) {
            await window.localforge.generate.saveRecord({
              id: crypto.randomUUID(),
              prompt: event.prompt ?? subject,
              seed: event.seed,
              model: 'z-image',
              output_path: event.output_path,
              thumbnail_path: event.thumbnail_path ?? '',
              created_at: Date.now(),
            })
          }
        }
      }
    } catch (e) {
      setGenerationResult({ status: 'error', lastError: String(e) })
    }
  }

  const isActive = status === 'generating' || status === 'queued'

  const stepBtn = (n: 1 | 2 | 3, label: string) => (
    <button
      onClick={() => setOpenStep(n)}
      style={{
        width: '100%',
        padding: '12px 16px',
        background: openStep === n ? 'var(--color-surface-raised)' : 'transparent',
        textAlign: 'left',
        color: openStep === n ? 'var(--color-accent)' : 'var(--color-text-primary)',
        fontWeight: 600,
        fontSize: 13,
      }}
    >
      {n} — {label}
    </button>
  )

  return (
    <div data-testid="screen-generate" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left panel: accordion prompt builder */}
        <div style={{ width: 400, background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', overflow: 'auto', flexShrink: 0 }}>

          {/* Step 1: Subject */}
          <div style={{ borderBottom: '1px solid var(--color-border)' }}>
            {stepBtn(1, 'Subject')}
            {openStep === 1 && (
              <div style={{ padding: '0 16px 16px' }}>
                <textarea
                  data-testid="subject-input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Describe your subject..."
                  rows={3}
                  style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '8px 10px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-ui)', fontSize: 13, resize: 'vertical', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SUBJECT_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => setSubject(chip)}
                      style={{ padding: '3px 10px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 20, fontSize: 11, color: 'var(--color-text-secondary)' }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Style */}
          <div style={{ borderBottom: '1px solid var(--color-border)' }}>
            {stepBtn(2, 'Style')}
            {openStep === 2 && (
              <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    data-testid={`style-card-${s.id}`}
                    onClick={() => setStyle(s.id)}
                    style={{ padding: 10, background: 'var(--color-bg)', border: `1px solid ${style === s.id ? 'var(--color-accent)' : 'var(--color-border)'}`, borderRadius: 'var(--radius)', textAlign: 'left', boxShadow: style === s.id ? '0 0 8px var(--color-accent-glow)' : 'none' }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 12, color: style === s.id ? 'var(--color-accent)' : 'var(--color-text-primary)', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{s.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 3: Shot */}
          <div>
            {stepBtn(3, 'Shot')}
            {openStep === 3 && (
              <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {SHOT_FIELDS.map(({ field, label, options }) => (
                  <div key={field}>
                    <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</label>
                    <select
                      data-testid={`shot-${field}`}
                      value={shot[field]}
                      onChange={(e) => setShotField(field, e.target.value)}
                      style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '6px 8px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-ui)', fontSize: 13, outline: 'none' }}
                    >
                      {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel: output preview */}
        <div data-testid="output-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', position: 'relative', overflow: 'hidden' }}>
          {outputImagePath ? (
            <img
              data-testid="output-image"
              src={`file:///${outputImagePath.replace(/\\/g, '/')}`}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 'var(--radius)' }}
              alt="Generated"
            />
          ) : (
            <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
              <div style={{ fontSize: 14 }}>Your image will appear here</div>
            </div>
          )}

          {seed !== null && outputImagePath && (
            <div style={{ position: 'absolute', bottom: 12, right: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: 4 }}>
              seed: {seed}
            </div>
          )}

          {status === 'error' && lastError && (
            <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, background: '#7F1D1D', border: '1px solid #EF4444', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12, color: '#FCA5A5' }}>
              {lastError.includes('CUDA out of memory') || lastError.includes('VRAM')
                ? 'Not enough VRAM — try reducing output resolution or switching to a lighter model'
                : lastError}
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ height: 56, borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16, flexShrink: 0 }}>
        <button
          data-testid="generate-btn"
          className="btn-primary"
          onClick={handleGenerate}
          disabled={isActive || !subject.trim()}
          style={{ flexShrink: 0 }}
        >
          {isActive ? 'Generating...' : 'Generate'}
        </button>

        {isActive && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, background: 'var(--color-border)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-accent), var(--color-accent-light))', transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              {progress}%
            </span>
          </div>
        )}

        {status === 'complete' && seed !== null && !isActive && (
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
            seed: {seed}
          </span>
        )}
      </div>
    </div>
  )
}
