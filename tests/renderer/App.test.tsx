import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import App from '../../src/renderer/src/App'
import { useAppStore } from '../../src/renderer/src/store/app.store'

describe('App', () => {
  beforeEach(() => {
    // setupComplete: true prevents SetupWizard from rendering, keeping tests simple
    useAppStore.setState({ activeScreen: 'generate', setupComplete: true })
  })

  it('shows Generate screen by default', () => {
    render(<App />)
    expect(screen.getByTestId('screen-generate')).toBeInTheDocument()
  })

  it('switches to Library screen on nav click', () => {
    render(<App />)
    fireEvent.click(screen.getByTitle('Library').closest('button')!)
    expect(screen.getByTestId('screen-library')).toBeInTheDocument()
  })
})
