// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Sidebar } from '../../src/renderer/src/components/Sidebar'
import { useAppStore } from '../../src/renderer/src/store/app.store'

describe('Sidebar', () => {
  it('renders 4 nav items', () => {
    render(<Sidebar />)
    expect(screen.getByTitle('Generate')).toBeInTheDocument()
    expect(screen.getByTitle('Library')).toBeInTheDocument()
    expect(screen.getByTitle('Models')).toBeInTheDocument()
    expect(screen.getByTitle('Settings')).toBeInTheDocument()
  })

  it('highlights active screen', () => {
    useAppStore.setState({ activeScreen: 'library' })
    render(<Sidebar />)
    expect(screen.getByTitle('Library').closest('button')).toHaveClass('active')
  })

  it('calls navigate on click', () => {
    useAppStore.setState({ activeScreen: 'generate' })
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle('Models').closest('button')!)
    expect(useAppStore.getState().activeScreen).toBe('models')
  })
})
