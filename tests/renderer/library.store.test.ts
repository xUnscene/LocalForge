import { describe, it, expect, beforeEach } from 'vitest'
import { useLibraryStore } from '../../src/renderer/src/store/library.store'

const MOCK_RECORD = {
  id: 'gen-1',
  prompt: 'a woman walking through a neon-lit tokyo street, cinematic',
  seed: 12345,
  model: 'z-image',
  output_path: 'C:\\Users\\user\\AppData\\Roaming\\LocalForge\\outputs\\gen-1.png',
  thumbnail_path: '',
  created_at: 1713456789000,
}

describe('LibraryStore', () => {
  beforeEach(() => {
    useLibraryStore.setState({ generations: [], selectedId: null })
  })

  it('setGenerations populates the list', () => {
    useLibraryStore.getState().setGenerations([MOCK_RECORD])
    expect(useLibraryStore.getState().generations).toHaveLength(1)
    expect(useLibraryStore.getState().generations[0].id).toBe('gen-1')
  })

  it('selectGeneration sets selectedId', () => {
    useLibraryStore.getState().selectGeneration('gen-1')
    expect(useLibraryStore.getState().selectedId).toBe('gen-1')
  })

  it('selectGeneration with null clears selection', () => {
    useLibraryStore.getState().selectGeneration('gen-1')
    useLibraryStore.getState().selectGeneration(null)
    expect(useLibraryStore.getState().selectedId).toBeNull()
  })
})
