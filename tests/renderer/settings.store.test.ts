import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from '../../src/renderer/src/store/settings.store'

describe('SettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      gpuName: null,
      vramGb: null,
      comfyStatus: null,
      outputPath: null,
      appVersion: null,
      isRestarting: false,
    })
  })

  it('setGpuInfo updates gpuName and vramGb', () => {
    useSettingsStore.getState().setGpuInfo('NVIDIA RTX 4090', 24)
    expect(useSettingsStore.getState().gpuName).toBe('NVIDIA RTX 4090')
    expect(useSettingsStore.getState().vramGb).toBe(24)
  })

  it('setComfyStatus updates comfyStatus', () => {
    useSettingsStore.getState().setComfyStatus('running')
    expect(useSettingsStore.getState().comfyStatus).toBe('running')
  })

  it('setOutputPath updates outputPath', () => {
    useSettingsStore.getState().setOutputPath('C:\\outputs')
    expect(useSettingsStore.getState().outputPath).toBe('C:\\outputs')
  })
})
