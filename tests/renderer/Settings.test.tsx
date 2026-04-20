import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Settings } from '../../src/renderer/src/screens/Settings'
import { useSettingsStore } from '../../src/renderer/src/store/settings.store'

// window.localforge IPC stubs (settings, app, sidecar, etc.) are provided by tests/setup.ts.
// The port used in fetch URL assertions (8765) comes from the sidecar.getStatus mock in setup.ts.
describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({
      gpuName: null,
      vramGb: null,
      comfyStatus: null,
      outputPath: null,
      appVersion: null,
      isRestarting: false,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'stopped', detected: false }),
    }))
  })

  it('renders screen-settings testid', () => {
    render(<Settings />)
    expect(screen.getByTestId('screen-settings')).toBeInTheDocument()
  })

  it('displays GPU name when store has gpu info', () => {
    useSettingsStore.setState({ gpuName: 'NVIDIA RTX 4090', vramGb: 24 })
    render(<Settings />)
    expect(screen.getByText('NVIDIA RTX 4090')).toBeInTheDocument()
    expect(screen.getByText(/24 GB/i)).toBeInTheDocument()
  })

  it('displays ComfyUI status when store has status', () => {
    useSettingsStore.setState({ comfyStatus: 'running' })
    render(<Settings />)
    expect(screen.getByText(/running/i)).toBeInTheDocument()
  })

  it('clicking Restart Engine button fetches engine stop then start', async () => {
    useSettingsStore.setState({ comfyStatus: 'running' })
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'running' }),
    })
    vi.stubGlobal('fetch', mockFetch)
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: /restart engine/i }))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8765/engine/stop',
        expect.objectContaining({ method: 'POST' })
      )
    })
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8765/engine/start',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })
})
