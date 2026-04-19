import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SetupWizard } from '../../src/renderer/src/components/SetupWizard'

describe('SetupWizard', () => {
  const onComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Override the global sidecar mock to return a port
    vi.mocked(window.localforge.sidecar.getStatus).mockResolvedValue({
      status: 'running',
      port: 8765,
    })
    global.fetch = vi.fn()
    // Minimal EventSource stub so component doesn't throw
    global.EventSource = vi.fn().mockImplementation(() => ({
      onmessage: null,
      close: vi.fn(),
    })) as any
  })

  it('renders welcome step by default', () => {
    render(<SetupWizard onComplete={onComplete} />)
    expect(screen.getByTestId('step-welcome')).toBeInTheDocument()
    expect(screen.getByText('Get Started')).toBeInTheDocument()
  })

  it('advances to hardware step and fetches gpu info on Get Started click', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () => Promise.resolve({ detected: false, name: null, vram_gb: null, sufficient: false }),
    } as any)
    render(<SetupWizard onComplete={onComplete} />)
    fireEvent.click(screen.getByText('Get Started'))
    await waitFor(() => expect(screen.getByTestId('step-hardware')).toBeInTheDocument())
  })

  it('shows gpu name and vram when gpu is detected', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () => Promise.resolve({ detected: true, name: 'RTX 4090', vram_gb: 24.0, sufficient: true }),
    } as any)
    render(<SetupWizard onComplete={onComplete} />)
    fireEvent.click(screen.getByText('Get Started'))
    await waitFor(() => expect(screen.getByText(/RTX 4090/)).toBeInTheDocument())
    expect(screen.getByText(/24/)).toBeInTheDocument()
  })

  it('shows warning when vram is insufficient', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () => Promise.resolve({ detected: true, name: 'RTX 3060', vram_gb: 6.0, sufficient: false }),
    } as any)
    render(<SetupWizard onComplete={onComplete} />)
    fireEvent.click(screen.getByText('Get Started'))
    await waitFor(() => expect(screen.getByText(/8GB\+ recommended/)).toBeInTheDocument())
  })
})
