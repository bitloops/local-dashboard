import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  validateQuery,
  validateVariables,
  runQueryExplorerQuery,
} from './run-query'

const mockSetResult = vi.fn()
const mockAddRunToHistory = vi.fn()
const mockGetState = vi.fn()
const mockSetQuery = vi.fn()

vi.mock('@/store', () => ({
  rootStoreInstance: {
    getState: () => mockGetState(),
  },
}))

vi.mock('./query-client', () => ({
  executeQuery: vi.fn(),
}))

describe('validateQuery', () => {
  it('returns error when query is empty', () => {
    expect(validateQuery('')).toEqual({
      ok: false,
      error: 'Query cannot be empty.',
    })
  })

  it('returns error when query is only whitespace', () => {
    expect(validateQuery('   \n\t  ')).toEqual({
      ok: false,
      error: 'Query cannot be empty.',
    })
  })

  it('returns error for invalid GraphQL syntax', () => {
    const result = validateQuery('query { ')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBeTruthy()
      expect(typeof result.error).toBe('string')
    }
  })

  it('returns ok for valid GraphQL', () => {
    expect(validateQuery('query { __typename }')).toEqual({ ok: true })
  })
})

describe('validateVariables', () => {
  it('returns error for invalid JSON', () => {
    expect(validateVariables('not json')).toEqual({
      ok: false,
      error: 'Invalid JSON in variables.',
    })
  })

  it('returns error when parsed value is null', () => {
    expect(validateVariables('null')).toEqual({
      ok: false,
      error: 'Variables must be a JSON object.',
    })
  })

  it('returns error when parsed value is an array', () => {
    expect(validateVariables('[]')).toEqual({
      ok: false,
      error: 'Variables must be a JSON object.',
    })
  })

  it('returns ok with parsed object for valid JSON object', () => {
    expect(validateVariables('{}')).toEqual({ ok: true, parsed: {} })
    expect(validateVariables('{"id":"x"}')).toEqual({
      ok: true,
      parsed: { id: 'x' },
    })
  })
})

describe('runQueryExplorerQuery', () => {
  const defaultState = () => ({
    query: 'query { __typename }',
    variables: '{}',
    setResult: mockSetResult,
    setQuery: mockSetQuery,
    addRunToHistory: mockAddRunToHistory,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockSetResult.mockClear()
    mockAddRunToHistory.mockClear()
    mockSetQuery.mockClear()
    mockGetState.mockImplementation(defaultState)
  })

  it('sets error result when query is empty', async () => {
    mockGetState.mockReturnValue({
      ...defaultState(),
      query: '',
    })

    await runQueryExplorerQuery()

    expect(mockSetResult).toHaveBeenCalledWith({
      status: 'error',
      error: 'Query cannot be empty.',
    })
    expect(mockAddRunToHistory).not.toHaveBeenCalled()
  })

  it('sets error result when variables are invalid JSON', async () => {
    mockGetState.mockReturnValue({
      ...defaultState(),
      variables: 'not json',
    })

    await runQueryExplorerQuery()

    expect(mockSetResult).toHaveBeenCalledWith({
      status: 'error',
      error: 'Invalid JSON in variables.',
    })
    expect(mockAddRunToHistory).not.toHaveBeenCalled()
  })

  it('sets loading, adds to history, and calls executeQuery when validation passes', async () => {
    const { executeQuery } = await import('./query-client')
    vi.mocked(executeQuery).mockResolvedValue({ data: { __typename: 'Query' } })

    await runQueryExplorerQuery()

    expect(mockSetResult).toHaveBeenCalledWith({ status: 'loading' })
    expect(mockSetQuery).toHaveBeenCalledWith(`query {
  __typename
}
`)
    expect(mockAddRunToHistory).toHaveBeenCalledWith(
      `query {
  __typename
}
`,
      '{}',
    )
    expect(executeQuery).toHaveBeenCalledWith(
      `query {
  __typename
}
`,
      {},
    )

    await vi.waitFor(() => {
      expect(mockSetResult).toHaveBeenLastCalledWith({
        status: 'success',
        data: { __typename: 'Query' },
        errors: undefined,
      })
    })
  })

  it('formats the query before executing and stores the formatted value', async () => {
    const { executeQuery } = await import('./query-client')
    vi.mocked(executeQuery).mockResolvedValue({ data: { __typename: 'Query' } })

    mockGetState.mockReturnValue({
      ...defaultState(),
      query: 'query Test{__typename}',
    })

    await runQueryExplorerQuery()

    expect(mockSetQuery).toHaveBeenCalledWith(`query Test {
  __typename
}
`)
    expect(mockAddRunToHistory).toHaveBeenCalledWith(
      `query Test {
  __typename
}
`,
      '{}',
    )
    expect(executeQuery).toHaveBeenCalledWith(
      `query Test {
  __typename
}
`,
      {},
    )
  })

  it('uses overrides when provided (for re-run from history)', async () => {
    const { executeQuery } = await import('./query-client')
    vi.mocked(executeQuery).mockResolvedValue({ data: { x: 1 } })

    await runQueryExplorerQuery({
      query: 'query GetX { x }',
      variables: '{"id":"y"}',
    })

    expect(mockAddRunToHistory).toHaveBeenCalledWith(
      `query GetX {
  x
}
`,
      '{"id":"y"}',
    )
    expect(executeQuery).toHaveBeenCalledWith(
      `query GetX {
  x
}
`,
      { id: 'y' },
    )
  })

  it('sets error result when executeQuery rejects with a generic Error', async () => {
    const { executeQuery } = await import('./query-client')
    vi.mocked(executeQuery).mockRejectedValue(new Error('Network failure'))

    await runQueryExplorerQuery()

    await vi.waitFor(() => {
      expect(mockSetResult).toHaveBeenLastCalledWith({
        status: 'error',
        error: 'Network failure',
      })
    })
  })

  it('sets error result when executeQuery rejects with GraphQLRequestError', async () => {
    const { GraphQLRequestError } = await import('@/api/graphql/errors')
    const { executeQuery } = await import('./query-client')
    const apiErr = new GraphQLRequestError('Server error', {
      status: 500,
      graphQLErrors: [{ message: 'upstream timeout' }],
    })
    vi.mocked(executeQuery).mockRejectedValue(apiErr)

    await runQueryExplorerQuery()

    await vi.waitFor(() => {
      expect(mockSetResult).toHaveBeenLastCalledWith({
        status: 'error',
        error: 'upstream timeout',
      })
    })
  })

  it('sets error result when response has errors but no data', async () => {
    const { executeQuery } = await import('./query-client')
    vi.mocked(executeQuery).mockResolvedValue({
      data: null,
      errors: [{ message: 'Field "x" not found' }],
    })

    await runQueryExplorerQuery()

    await vi.waitFor(() => {
      expect(mockSetResult).toHaveBeenLastCalledWith({
        status: 'error',
        error: 'Field "x" not found',
      })
    })
  })

  it('sets success with partial errors when response has both data and errors', async () => {
    const { executeQuery } = await import('./query-client')
    vi.mocked(executeQuery).mockResolvedValue({
      data: { __typename: 'Query' },
      errors: [{ message: 'partial failure' }],
    })

    await runQueryExplorerQuery()

    await vi.waitFor(() => {
      expect(mockSetResult).toHaveBeenLastCalledWith({
        status: 'success',
        data: { __typename: 'Query' },
        errors: ['partial failure'],
      })
    })
  })

  it('sets fallback error message when executeQuery rejects with non-Error', async () => {
    const { executeQuery } = await import('./query-client')
    vi.mocked(executeQuery).mockRejectedValue('string rejection')

    await runQueryExplorerQuery()

    await vi.waitFor(() => {
      expect(mockSetResult).toHaveBeenLastCalledWith({
        status: 'error',
        error: 'Request failed.',
      })
    })
  })

  it('ignores stale result from older request when a newer request is in flight', async () => {
    const { executeQuery } = await import('./query-client')
    let resolveFirst!: (value: {
      data: unknown
      errors?: Array<{ message: string }>
    }) => void
    let resolveSecond!: (value: {
      data: unknown
      errors?: Array<{ message: string }>
    }) => void

    vi.mocked(executeQuery)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve
          }),
      )

    const firstRun = runQueryExplorerQuery({
      query: 'query { first }',
      variables: '{}',
    })
    const secondRun = runQueryExplorerQuery({
      query: 'query { second }',
      variables: '{}',
    })

    await vi.waitFor(() => {
      expect(executeQuery).toHaveBeenCalledTimes(2)
    })

    resolveSecond({ data: { value: 'newer' } })
    await vi.waitFor(() => {
      expect(mockSetResult).toHaveBeenLastCalledWith({
        status: 'success',
        data: { value: 'newer' },
        errors: undefined,
      })
    })

    resolveFirst({ data: { value: 'older' } })
    await vi.waitFor(() => {
      expect(mockSetResult).toHaveBeenLastCalledWith({
        status: 'success',
        data: { value: 'newer' },
        errors: undefined,
      })
    })

    await Promise.all([firstRun, secondRun])
  })
})
