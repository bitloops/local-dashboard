import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { DevQLSchema } from '@/store/types'
import {
  executeQuery,
  getQuerySchema,
  type QueryApiResponse,
} from './query-client'

const mockExecuteRequest =
  vi.fn<
    (params: {
      method: string
      url: string
      body?: unknown
      mediaType?: string
    }) => Promise<QueryApiResponse>
  >()

const mockSchemaRequest =
  vi.fn<(params: { method: string; url: string }) => Promise<DevQLSchema>>()

vi.mock('@/api/types/schema', () => ({
  BitloopsCli: vi.fn().mockImplementation(() => ({
    request: {
      request: vi.fn(
        (params: {
          method: string
          url: string
          body?: unknown
          mediaType?: string
        }) => {
          if (params.url === '/api/query-schema') {
            return mockSchemaRequest(params)
          }
          return mockExecuteRequest(params)
        },
      ),
    },
  })),
}))

describe('query-client', () => {
  beforeEach(() => {
    mockExecuteRequest.mockReset()
    mockSchemaRequest.mockReset()
  })

  describe('executeQuery', () => {
    it('sends POST to /api/query with query and variables', async () => {
      const response: QueryApiResponse = { data: { repo: null } }
      mockExecuteRequest.mockResolvedValue(response)

      const result = await executeQuery('query { repo }', { id: 'x' })

      expect(mockExecuteRequest).toHaveBeenCalledTimes(1)
      expect(mockExecuteRequest).toHaveBeenCalledWith({
        method: 'POST',
        url: '/api/query',
        body: { query: 'query { repo }', variables: { id: 'x' } },
        mediaType: 'application/json',
      })
      expect(result).toEqual(response)
    })

    it('resolves with response data when request succeeds', async () => {
      const response: QueryApiResponse = {
        data: { repo: { ref: { file: { artefacts: [] } } } },
      }
      mockExecuteRequest.mockResolvedValue(response)

      const result = await executeQuery(
        'query GetArtefacts { repo { ref { file { artefacts { symbolFqn } } } } }',
        {},
      )

      expect(result).toEqual(response)
      expect(result.data).toEqual(response.data)
    })

    it('resolves with response including errors when API returns partial success', async () => {
      const response: QueryApiResponse = {
        data: { repo: { ref: null } },
        errors: [{ message: "Ref 'main' not found." }],
      }
      mockExecuteRequest.mockResolvedValue(response)

      const result = await executeQuery('query { repo { ref { name } } }', {})

      expect(result.data).toEqual(response.data)
      expect(result.errors).toHaveLength(1)
      expect(result.errors?.[0].message).toBe("Ref 'main' not found.")
    })

    it('rejects when request fails', async () => {
      const error = new Error('Network error')
      mockExecuteRequest.mockRejectedValue(error)

      await expect(executeQuery('query { }', {})).rejects.toThrow(
        'Network error',
      )
    })
  })

  describe('getQuerySchema', () => {
    it('sends GET to /api/query-schema', async () => {
      const schema: DevQLSchema = {
        Query: { fields: { repo: { type: 'Repo' } } },
      }
      mockSchemaRequest.mockResolvedValue(schema)

      const result = await getQuerySchema()

      expect(mockSchemaRequest).toHaveBeenCalledTimes(1)
      expect(mockSchemaRequest).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/query-schema',
      })
      expect(result).toEqual(schema)
    })
  })
})
