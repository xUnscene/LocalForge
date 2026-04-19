import { describe, it, expect, beforeEach } from 'vitest'
import { useGenerateStore } from '../../src/renderer/src/store/generate.store'

describe('GenerateStore', () => {
  beforeEach(() => {
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
  })

  it('defaults to cinematic style', () => {
    expect(useGenerateStore.getState().style).toBe('cinematic')
  })

  it('setSubject updates subject', () => {
    useGenerateStore.getState().setSubject('a cat in rain')
    expect(useGenerateStore.getState().subject).toBe('a cat in rain')
  })

  it('setShotField updates only that field', () => {
    useGenerateStore.getState().setShotField('ratio', '1:1')
    const shot = useGenerateStore.getState().shot
    expect(shot.ratio).toBe('1:1')
    expect(shot.camera).toBe('Sony A7 IV')
  })

  it('setGenerationResult updates multiple fields', () => {
    useGenerateStore.getState().setGenerationResult({
      status: 'complete',
      progress: 100,
      seed: 999,
      outputImagePath: '/out/test.png',
    })
    const state = useGenerateStore.getState()
    expect(state.status).toBe('complete')
    expect(state.seed).toBe(999)
    expect(state.outputImagePath).toBe('/out/test.png')
  })
})
