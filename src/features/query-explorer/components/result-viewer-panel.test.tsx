import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultViewerPanel } from './result-viewer-panel'

vi.mock('@andypf/json-viewer/dist/esm/react/JsonViewer', () => ({
  default: ({ data }: { data: unknown }) => {
    const obj = data as { errors?: string[] }
    if (obj?.errors?.length) {
      return (
        <pre data-testid='mock-json-viewer-error'>{obj.errors.join(', ')}</pre>
      )
    }
    return (
      <pre data-testid='mock-json-viewer'>{JSON.stringify(data, null, 2)}</pre>
    )
  },
}))

describe('ResultViewerPanel', () => {
  it('renders Results heading', () => {
    render(<ResultViewerPanel result={{ status: 'idle' }} />)
    expect(screen.getByText('Results')).toBeInTheDocument()
  })

  it('shows idle message when status is idle', () => {
    render(<ResultViewerPanel result={{ status: 'idle' }} />)
    expect(screen.getByText('Run a query to see results.')).toBeInTheDocument()
  })

  it('shows centered loading spinner when status is loading', () => {
    render(<ResultViewerPanel result={{ status: 'loading' }} />)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows JSON tree when status is success', () => {
    render(
      <ResultViewerPanel
        result={{ status: 'success', data: { foo: 'bar' } }}
      />,
    )
    expect(screen.getByTestId('result-viewer-json-tree')).toBeInTheDocument()
    expect(screen.getByTestId('mock-json-viewer')).toHaveTextContent('"foo"')
    expect(screen.getByTestId('mock-json-viewer')).toHaveTextContent('"bar"')
  })

  it('shows errors in same tree with success when errors are present', () => {
    render(
      <ResultViewerPanel
        result={{
          status: 'success',
          data: { message: 'ok' },
          errors: ['First error', 'Second error'],
        }}
      />,
    )
    expect(screen.getByTestId('result-viewer-json-tree')).toBeInTheDocument()
    expect(screen.getByTestId('mock-json-viewer-error')).toHaveTextContent(
      'First error',
    )
    expect(screen.getByTestId('mock-json-viewer-error')).toHaveTextContent(
      'Second error',
    )
  })

  it('shows error message and error-state content area when status is error', () => {
    const { container } = render(
      <ResultViewerPanel
        result={{ status: 'error', error: 'Network failed' }}
      />,
    )
    expect(screen.getByText('Network failed')).toBeInTheDocument()
    const contentArea = container.querySelector('[data-error="true"]')
    expect(contentArea).toBeInTheDocument()
  })
})
