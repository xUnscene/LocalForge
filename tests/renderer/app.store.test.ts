import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../src/renderer/src/store/app.store'

describe('AppStore', () => {
  beforeEach(() => useAppStore.setState({ activeScreen: 'generate' }))

  it('defaults to generate screen', () => {
    expect(useAppStore.getState().activeScreen).toBe('generate')
  })

  it('navigates to library screen', () => {
    useAppStore.getState().navigate('library')
    expect(useAppStore.getState().activeScreen).toBe('library')
  })

  it('navigates to models screen', () => {
    useAppStore.getState().navigate('models')
    expect(useAppStore.getState().activeScreen).toBe('models')
  })

  it('navigates to settings screen', () => {
    useAppStore.getState().navigate('settings')
    expect(useAppStore.getState().activeScreen).toBe('settings')
  })
})
