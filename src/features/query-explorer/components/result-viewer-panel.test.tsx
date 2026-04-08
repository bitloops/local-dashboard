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
    const tree = screen.getByTestId('query-result-json-tree')
    expect(screen.getByTestId('result-viewer-json-tree')).toBeInTheDocument()
    expect(tree).toHaveTextContent('"foo"')
    expect(tree).toHaveTextContent('"bar"')
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
    const tree = screen.getByTestId('query-result-json-tree')
    expect(screen.getByTestId('result-viewer-json-tree')).toBeInTheDocument()
    expect(tree).toHaveTextContent('First error')
    expect(tree).toHaveTextContent('Second error')
  })

  it('shows blob preview hint for success+errors payload when data has previewable blobSha', () => {
    const sha = `${'c'.repeat(40)}`
    render(
      <ResultViewerPanel
        result={{
          status: 'success',
          data: { blobSha: sha },
          errors: ['Partial error'],
        }}
        variables={JSON.stringify({ repo: 'r' })}
      />,
    )
    expect(screen.getByTestId('result-blob-preview-hint')).toHaveTextContent(
      'clickable',
    )
  })

  it('shows blob preview hint when data contains a previewable blobSha', () => {
    const sha = `${'a'.repeat(40)}`
    render(
      <ResultViewerPanel
        result={{ status: 'success', data: { blobSha: sha } }}
        variables={JSON.stringify({ repo: 'r' })}
      />,
    )
    expect(screen.getByTestId('result-blob-preview-hint')).toBeInTheDocument()
    expect(screen.getByTestId('result-blob-preview-hint')).toHaveTextContent(
      'clickable',
    )
  })

  it('shows repo Variables hint when blobSha present but repo is not set', () => {
    const sha = `${'b'.repeat(40)}`
    render(
      <ResultViewerPanel
        result={{ status: 'success', data: { blobSha: sha } }}
        variables='{}'
      />,
    )
    expect(screen.getByTestId('result-blob-preview-hint')).toHaveTextContent(
      'Variables',
    )
  })

  it('does not show blob preview hint when no blobSha in data', () => {
    render(
      <ResultViewerPanel
        result={{ status: 'success', data: { foo: 'bar' } }}
      />,
    )
    expect(screen.queryByTestId('result-blob-preview-hint')).toBeNull()
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
