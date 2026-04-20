import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Library } from '../../src/renderer/src/screens/Library'
import { useLibraryStore } from '../../src/renderer/src/store/library.store'
import { useGenerateStore } from '../../src/renderer/src/store/generate.store'
import { useAppStore } from '../../src/renderer/src/store/app.store'

const MOCK_RECORD = {
  id: 'gen-1',
  prompt: 'a woman walking through a neon-lit tokyo street, cinematic',
  seed: 12345,
  model: 'z-image',
  output_path: 'C:\\Users\\user\\AppData\\Roaming\\LocalForge\\outputs\\gen-1.png',
  thumbnail_path: '',
  created_at: 1713456789000,
}

describe('Library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLibraryStore.setState({ generations: [], selectedId: null })
    vi.mocked(window.localforge.db.getAllGenerations).mockResolvedValue([])
  })

  it('renders screen-library testid', () => {
    render(<Library />)
    expect(screen.getByTestId('screen-library')).toBeInTheDocument()
  })

  it('shows empty state when no generations', () => {
    render(<Library />)
    expect(screen.getByText(/no generations yet/i)).toBeInTheDocument()
  })

  it('renders a generation card when store has records', () => {
    useLibraryStore.setState({ generations: [MOCK_RECORD] })
    render(<Library />)
    expect(screen.getByTestId('gen-card-gen-1')).toBeInTheDocument()
  })

  it('clicking a card opens the modal with seed metadata', () => {
    useLibraryStore.setState({ generations: [MOCK_RECORD] })
    render(<Library />)
    fireEvent.click(screen.getByTestId('gen-card-gen-1'))
    expect(screen.getByTestId('generation-modal')).toBeInTheDocument()
    expect(screen.getByText('12345')).toBeInTheDocument()
  })

  it('Re-generate button pre-fills subject and navigates to generate screen', () => {
    useLibraryStore.setState({ generations: [MOCK_RECORD], selectedId: 'gen-1' })
    render(<Library />)
    fireEvent.click(screen.getByRole('button', { name: /re-generate/i }))
    expect(useGenerateStore.getState().subject).toBe(MOCK_RECORD.prompt)
    expect(useLibraryStore.getState().selectedId).toBeNull()
    expect(useAppStore.getState().activeScreen).toBe('generate')
  })
})
