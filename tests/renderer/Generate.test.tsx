import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Generate } from '../../src/renderer/src/screens/Generate'
import { useGenerateStore } from '../../src/renderer/src/store/generate.store'

describe('Generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGenerateStore.setState({
      subject: '',
      style: 'cinematic',
      shot: { camera: 'Sony A7 IV', lens: '35mm f/1.4', lighting: 'Natural', ratio: '16:9' },
      status: 'idle',
      progress: 0,
      seed: null,
      outputImagePath: null,
      lastError: null,
    })
    vi.mocked(window.localforge.sidecar.getStatus).mockResolvedValue({ status: 'running', port: 8765 })
    global.fetch = vi.fn()
  })

  it('renders subject textarea and data-testid', () => {
    render(<Generate />)
    expect(screen.getByTestId('screen-generate')).toBeInTheDocument()
    expect(screen.getByTestId('subject-input')).toBeInTheDocument()
  })

  it('clicking a style card updates the store', () => {
    render(<Generate />)
    fireEvent.click(screen.getByText('2 — Style'))
    fireEvent.click(screen.getByTestId('style-card-street'))
    expect(useGenerateStore.getState().style).toBe('street')
  })

  it('Generate button is disabled when subject is empty', () => {
    render(<Generate />)
    expect(screen.getByTestId('generate-btn')).toBeDisabled()
  })

  it('clicking Generate POSTs to sidecar /generate with subject and style', async () => {
    const sseBody = 'data: {"status":"complete","percent":100,"seed":42,"output_path":"/out/img.png","error":null}\n\n'
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseBody))
        controller.close()
      },
    })
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, body: readable } as any)
    vi.mocked(window.localforge.generate.saveRecord).mockResolvedValue({ success: true } as any)

    useGenerateStore.setState({ subject: 'a cat in rain' })
    render(<Generate />)
    fireEvent.click(screen.getByTestId('generate-btn'))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/generate'),
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('passes thumbnail_path from SSE complete event to saveRecord', async () => {
    const sseBody =
      'data: {"status":"complete","percent":100,"seed":42,"output_path":"/out/img.png","thumbnail_path":"/out/thumbnails/img_thumb.jpg","error":null,"prompt":"a cat in rain"}\n\n'
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseBody))
        controller.close()
      },
    })
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, body: readable } as any)
    vi.mocked(window.localforge.generate.saveRecord).mockResolvedValue({ success: true } as any)

    useGenerateStore.setState({ subject: 'a cat in rain' })
    render(<Generate />)
    fireEvent.click(screen.getByTestId('generate-btn'))

    await waitFor(() =>
      expect(window.localforge.generate.saveRecord).toHaveBeenCalledWith(
        expect.objectContaining({ thumbnail_path: '/out/thumbnails/img_thumb.jpg' })
      )
    )
  })
})
