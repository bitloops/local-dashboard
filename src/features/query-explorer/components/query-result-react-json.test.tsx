import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryResultReactJson } from './query-result-react-json'

/** Avoid coupling tests to RJV DOM; exercise `onSelect` + parent logic only. */
vi.mock('@microlink/react-json-view', () => ({
  default: function MockReactJson({
    src,
    onSelect,
  }: {
    src: Record<string, unknown>
    onSelect?: (s: {
      name: string | null
      value: object | string | number | boolean | null
      type: string
      namespace: Array<string | null>
    }) => void
  }) {
    if (typeof src.blobSha === 'string') {
      return (
        <button
          type='button'
          data-testid='rjv-mock-blobsha-trigger'
          onClick={() =>
            onSelect?.({
              name: 'blobSha',
              value: src.blobSha as string,
              type: 'string',
              namespace: [],
            })
          }
        >
          Trigger blob preview
        </button>
      )
    }
    return <pre data-testid='rjv-mock-fallback'>{JSON.stringify(src)}</pre>
  },
}))

describe('QueryResultReactJson', () => {
  it('calls onOpenBlob when blobSha value is activated with repo set', async () => {
    const user = userEvent.setup()
    const onOpenBlob = vi.fn()
    const sha = `${'a'.repeat(40)}`
    render(
      <QueryResultReactJson
        data={{ blobSha: sha }}
        repoForBlobs='demo'
        onOpenBlob={onOpenBlob}
        theme='light'
      />,
    )
    await user.click(screen.getByTestId('rjv-mock-blobsha-trigger'))
    expect(onOpenBlob).toHaveBeenCalledWith(sha.toLowerCase())
  })

  it('does not open blob when repo is missing', async () => {
    const user = userEvent.setup()
    const onOpenBlob = vi.fn()
    const sha = `${'c'.repeat(40)}`
    render(
      <QueryResultReactJson
        data={{ blobSha: sha }}
        repoForBlobs={null}
        onOpenBlob={onOpenBlob}
        theme='light'
      />,
    )
    await user.click(screen.getByTestId('rjv-mock-blobsha-trigger'))
    expect(onOpenBlob).not.toHaveBeenCalled()
  })

  it('renders object keys from data', () => {
    render(
      <QueryResultReactJson
        data={{ foo: 1, bar: 2 }}
        repoForBlobs={null}
        onOpenBlob={vi.fn()}
        theme='light'
      />,
    )
    expect(screen.getByTestId('rjv-mock-fallback')).toHaveTextContent('foo')
    expect(screen.getByTestId('rjv-mock-fallback')).toHaveTextContent('bar')
  })
})
