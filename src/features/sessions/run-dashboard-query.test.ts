import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GraphQLRequestError } from '@/api/graphql/errors'
import { runDashboardQueryExplorerQuery } from './run-dashboard-query'

const mockSetResult = vi.fn()
const mockAddRunToHistory = vi.fn()
const mockGetState = vi.fn()
const mockSetQuery = vi.fn()
const mockRequestDashboardGraphQL = vi.fn()
const mockFormatGraphqlDocument = vi.fn<(query: string) => Promise<string>>(
  async (query) => query,
)

vi.mock('@/store', () => ({
  rootStoreInstance: {
    getState: () => mockGetState(),
  },
}))

vi.mock('@/api/dashboard/client', () => ({
  requestDashboardGraphQL: (...args: unknown[]) =>
    mockRequestDashboardGraphQL(...args),
}))

vi.mock('@/features/query-explorer/graphql/format', () => ({
  formatGraphqlDocument: (...args: [string]) =>
    mockFormatGraphqlDocument(...args),
}))

describe('runDashboardQueryExplorerQuery', () => {
  const defaultState = () => ({
    query: 'query { __typename }',
    variables: '{}',
    setResult: mockSetResult,
    setQuery: mockSetQuery,
    addRunToHistory: mockAddRunToHistory,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFormatGraphqlDocument.mockImplementation(async (query) => query)
    mockGetState.mockImplementation(defaultState)
  })

  it('sets an error when the query is empty', async () => {
    mockGetState.mockReturnValue({
      ...defaultState(),
      query: '',
    })

    await runDashboardQueryExplorerQuery()

    expect(mockSetResult).toHaveBeenCalledWith({
      status: 'error',
      error: 'Query cannot be empty.',
    })
    expect(mockAddRunToHistory).not.toHaveBeenCalled()
    expect(mockRequestDashboardGraphQL).not.toHaveBeenCalled()
  })

  it('sets an error when variables are invalid JSON', async () => {
    mockGetState.mockReturnValue({
      ...defaultState(),
      variables: 'not json',
    })

    await runDashboardQueryExplorerQuery()

    expect(mockSetResult).toHaveBeenCalledWith({
      status: 'error',
      error: 'Invalid JSON in variables.',
    })
    expect(mockAddRunToHistory).not.toHaveBeenCalled()
    expect(mockRequestDashboardGraphQL).not.toHaveBeenCalled()
  })

  it('formats the query, stores it, and succeeds when the request returns data', async () => {
    mockFormatGraphqlDocument.mockResolvedValue(`query {
  __typename
}
`)
    mockRequestDashboardGraphQL.mockResolvedValue({
      data: { __typename: 'Query' },
    })

    await runDashboardQueryExplorerQuery()

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
    expect(mockRequestDashboardGraphQL).toHaveBeenCalledWith(
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

  it('uses overrides without writing the formatted query back to the store', async () => {
    mockFormatGraphqlDocument.mockResolvedValue(`query GetThing {
  thing
}
`)
    mockRequestDashboardGraphQL.mockResolvedValue({ data: { thing: 1 } })

    await runDashboardQueryExplorerQuery({
      query: 'query GetThing{thing}',
      variables: '{"id":"abc"}',
    })

    expect(mockSetQuery).not.toHaveBeenCalled()
    expect(mockAddRunToHistory).toHaveBeenCalledWith(
      `query GetThing {
  thing
}
`,
      '{"id":"abc"}',
    )
    expect(mockRequestDashboardGraphQL).toHaveBeenCalledWith(
      `query GetThing {
  thing
}
`,
      { id: 'abc' },
    )
  })

  it('falls through when formatting fails and still validates the raw query', async () => {
    mockFormatGraphqlDocument.mockRejectedValue(new Error('format failed'))
    mockRequestDashboardGraphQL.mockResolvedValue({
      data: { __typename: 'Query' },
    })

    await runDashboardQueryExplorerQuery({
      query: 'query { __typename }',
      variables: '{}',
    })

    expect(mockAddRunToHistory).toHaveBeenCalledWith(
      'query { __typename }',
      '{}',
    )
    expect(mockRequestDashboardGraphQL).toHaveBeenCalledWith(
      'query { __typename }',
      {},
    )
  })

  it('sets an error when the response has GraphQL errors and no data', async () => {
    mockRequestDashboardGraphQL.mockResolvedValue({
      data: null,
      errors: [{ message: 'Field not found' }],
    })

    await runDashboardQueryExplorerQuery()

    await vi.waitFor(() => {
      expect(mockSetResult).toHaveBeenLastCalledWith({
        status: 'error',
        error: 'Field not found',
      })
    })
  })

  it('sets success with partial errors when the response has data and errors', async () => {
    mockRequestDashboardGraphQL.mockResolvedValue({
      data: { thing: 1 },
      errors: [{ message: 'partial failure' }],
    })

    await runDashboardQueryExplorerQuery()

    await vi.waitFor(() => {
      expect(mockSetResult).toHaveBeenLastCalledWith({
        status: 'success',
        data: { thing: 1 },
        errors: ['partial failure'],
      })
    })
  })

  it('sets success with null data when the request resolves without errors', async () => {
    mockRequestDashboardGraphQL.mockResolvedValue({
      data: null,
      errors: [],
    })

    await runDashboardQueryExplorerQuery()

    await vi.waitFor(() => {
      expect(mockSetResult).toHaveBeenLastCalledWith({
        status: 'success',
        data: null,
        errors: undefined,
      })
    })
  })

  it('uses the first GraphQL error message from GraphQLRequestError', async () => {
    mockRequestDashboardGraphQL.mockRejectedValue(
      new GraphQLRequestError('Server error', {
        status: 500,
        graphQLErrors: [{ message: 'upstream timeout' }],
      }),
    )

    await runDashboardQueryExplorerQuery()

    await vi.waitFor(() => {
      expect(mockSetResult).toHaveBeenLastCalledWith({
        status: 'error',
        error: 'upstream timeout',
      })
    })
  })

  it('falls back to the GraphQLRequestError message when no graphQLErrors exist', async () => {
    mockRequestDashboardGraphQL.mockRejectedValue(
      new GraphQLRequestError('Server error', {
        status: 500,
        graphQLErrors: [],
      }),
    )

    await runDashboardQueryExplorerQuery()

    await vi.waitFor(() => {
      expect(mockSetResult).toHaveBeenLastCalledWith({
        status: 'error',
        error: 'Server error',
      })
    })
  })

  it('uses the generic error message for non-GraphQL errors', async () => {
    mockRequestDashboardGraphQL.mockRejectedValue(new Error('Network failure'))

    await runDashboardQueryExplorerQuery()

    await vi.waitFor(() => {
      expect(mockSetResult).toHaveBeenLastCalledWith({
        status: 'error',
        error: 'Network failure',
      })
    })
  })

  it('uses the fallback message for non-Error rejections', async () => {
    mockRequestDashboardGraphQL.mockRejectedValue('string rejection')

    await runDashboardQueryExplorerQuery()

    await vi.waitFor(() => {
      expect(mockSetResult).toHaveBeenLastCalledWith({
        status: 'error',
        error: 'Request failed.',
      })
    })
  })

  it('ignores stale results from older requests', async () => {
    let resolveFirst!: (value: {
      data: unknown
      errors?: Array<{ message: string }>
    }) => void
    let resolveSecond!: (value: {
      data: unknown
      errors?: Array<{ message: string }>
    }) => void

    mockRequestDashboardGraphQL
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

    const firstRun = runDashboardQueryExplorerQuery({
      query: 'query { first }',
      variables: '{}',
    })
    const secondRun = runDashboardQueryExplorerQuery({
      query: 'query { second }',
      variables: '{}',
    })

    await vi.waitFor(() => {
      expect(mockRequestDashboardGraphQL).toHaveBeenCalledTimes(2)
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
