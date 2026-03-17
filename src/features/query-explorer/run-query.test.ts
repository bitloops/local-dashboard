import { describe, expect, it, vi } from 'vitest'
import {
  validateQuery,
  validateVariables,
  runQueryExplorerQuery,
} from './run-query'

const mockSetResult = vi.fn()
const mockAddRunToHistory = vi.fn()
const mockGetState = vi.fn()

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
    addRunToHistory: mockAddRunToHistory,
  })

  beforeEach(() => {
    mockSetResult.mockClear()
    mockAddRunToHistory.mockClear()
    mockGetState.mockImplementation(defaultState)
  })

  it('sets error result when query is empty', () => {
    mockGetState.mockReturnValue({
      ...defaultState(),
      query: '',
    })

    runQueryExplorerQuery()

    expect(mockSetResult).toHaveBeenCalledWith({
      status: 'error',
      error: 'Query cannot be empty.',
    })
    expect(mockAddRunToHistory).not.toHaveBeenCalled()
  })

  it('sets error result when variables are invalid JSON', () => {
    mockGetState.mockReturnValue({
      ...defaultState(),
      variables: 'not json',
    })

    runQueryExplorerQuery()

    expect(mockSetResult).toHaveBeenCalledWith({
      status: 'error',
      error: 'Invalid JSON in variables.',
    })
    expect(mockAddRunToHistory).not.toHaveBeenCalled()
  })

  it('sets loading, adds to history, and calls executeQuery when validation passes', async () => {
    const { executeQuery } = await import('./query-client')
    vi.mocked(executeQuery).mockResolvedValue({ data: { __typename: 'Query' } })

    runQueryExplorerQuery()

    expect(mockSetResult).toHaveBeenCalledWith({ status: 'loading' })
    expect(mockAddRunToHistory).toHaveBeenCalledWith(
      'query { __typename }',
      '{}',
    )
    expect(executeQuery).toHaveBeenCalledWith('query { __typename }', {})

    await vi.waitFor(() => {
      expect(mockSetResult).toHaveBeenLastCalledWith({
        status: 'success',
        data: { __typename: 'Query' },
        errors: undefined,
      })
    })
  })

  it('uses overrides when provided (for re-run from history)', async () => {
    const { executeQuery } = await import('./query-client')
    vi.mocked(executeQuery).mockResolvedValue({ data: { x: 1 } })

    runQueryExplorerQuery({
      query: 'query GetX { x }',
      variables: '{"id":"y"}',
    })

    expect(mockAddRunToHistory).toHaveBeenCalledWith(
      'query GetX { x }',
      '{"id":"y"}',
    )
    expect(executeQuery).toHaveBeenCalledWith('query GetX { x }', { id: 'y' })
  })
})
