import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultViewerPanel } from './result-viewer-panel'

describe('ResultViewerPanel', () => {
  it('renders Results heading', () => {
    render(<ResultViewerPanel result={{ status: 'idle' }} />)
    expect(screen.getByText('Results')).toBeInTheDocument()
  })

  it('shows idle message when status is idle', () => {
    render(<ResultViewerPanel result={{ status: 'idle' }} />)
    expect(screen.getByText('Run a query to see results.')).toBeInTheDocument()
  })

  it('shows loading message when status is loading', () => {
    render(<ResultViewerPanel result={{ status: 'loading' }} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows formatted JSON when status is success', () => {
    render(
      <ResultViewerPanel
        result={{ status: 'success', data: { foo: 'bar' } }}
      />,
    )
    expect(screen.getByText(/"foo":\s*"bar"/)).toBeInTheDocument()
  })

  it('shows error message when status is error', () => {
    render(
      <ResultViewerPanel
        result={{ status: 'error', error: 'Network failed' }}
      />,
    )
    expect(screen.getByText('Network failed')).toBeInTheDocument()
  })
})
