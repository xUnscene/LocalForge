import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Models } from '../../src/renderer/src/screens/Models'
import { useModelsStore } from '../../src/renderer/src/store/models.store'

const MOCK_MODEL = {
  id: 'z-image',
  name: 'Z-Image (Lumina-2)',
  description: 'High-quality cinematic image generation.',
  vramRequiredGb: 8,
  downloadSizeGb: 6.5,
  installed: false,
  sizeOnDiskGb: null,
  badge: 'Perfect for your GPU',
}

describe('Models', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useModelsStore.setState({
      models: [],
      installStatus: {},
      installProgress: {},
      installError: {},
    })
    vi.mocked(window.localforge.sidecar.getStatus).mockResolvedValue({ status: 'running', port: 8765 })
    global.fetch = vi.fn()
  })

  it('renders screen-models testid', () => {
    render(<Models />)
    expect(screen.getByTestId('screen-models')).toBeInTheDocument()
  })

  it('displays model card when models are in the store', () => {
    useModelsStore.setState({ models: [MOCK_MODEL] })
    render(<Models />)
    expect(screen.getByText('Z-Image (Lumina-2)')).toBeInTheDocument()
    expect(screen.getByText('Perfect for your GPU')).toBeInTheDocument()
  })

  it('shows Install button when model is not installed', () => {
    useModelsStore.setState({ models: [MOCK_MODEL] })
    render(<Models />)
    expect(screen.getByTestId('install-btn-z-image')).toBeInTheDocument()
  })

  it('clicking Install POSTs to /models/{id}/install', async () => {
    const encoder = new TextEncoder()
    const sseBody = 'data: {"status":"complete","percent":100,"error":null}\n\n'
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseBody))
        controller.close()
      },
    })
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, body: readable } as any)

    useModelsStore.setState({ models: [MOCK_MODEL] })
    render(<Models />)
    fireEvent.click(screen.getByTestId('install-btn-z-image'))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/models/z-image/install'),
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })
})
