import { describe, it, expect, beforeEach } from 'vitest'
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

describe('ModelsStore', () => {
  beforeEach(() => {
    useModelsStore.setState({
      models: [],
      installStatus: {},
      installProgress: {},
      installError: {},
    })
  })

  it('setModels populates the model list', () => {
    useModelsStore.getState().setModels([MOCK_MODEL])
    expect(useModelsStore.getState().models).toHaveLength(1)
    expect(useModelsStore.getState().models[0].id).toBe('z-image')
  })

  it('setInstallStatus updates status and progress', () => {
    useModelsStore.getState().setInstallStatus('z-image', 'downloading', 42)
    expect(useModelsStore.getState().installStatus['z-image']).toBe('downloading')
    expect(useModelsStore.getState().installProgress['z-image']).toBe(42)
  })

  it('markInstalled sets installed to true', () => {
    useModelsStore.getState().setModels([MOCK_MODEL])
    useModelsStore.getState().markInstalled('z-image')
    expect(useModelsStore.getState().models[0].installed).toBe(true)
  })

  it('markRemoved sets installed to false and clears size', () => {
    useModelsStore.getState().setModels([{ ...MOCK_MODEL, installed: true, sizeOnDiskGb: 6.5 }])
    useModelsStore.getState().markRemoved('z-image')
    const m = useModelsStore.getState().models[0]
    expect(m.installed).toBe(false)
    expect(m.sizeOnDiskGb).toBeNull()
  })
})
