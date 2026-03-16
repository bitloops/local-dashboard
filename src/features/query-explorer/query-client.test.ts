import { describe, expect, it, vi } from 'vitest'
import { executeQuery, type QueryApiResponse } from './query-client'

const mockRequest = vi.fn<
  (params: { method: string; url: string; body: unknown; mediaType: string }) => Promise<QueryApiResponse>
>()

vi.mock('@/api/types/schema', () => ({
  BitloopsCli: vi.fn().mockImplementation(() => ({
    request: {
      request: mockRequest,
    },
  })),
}))

describe('query-client', () => {
  beforeEach(() => {
    mockRequest.mockReset()
  })

  describe('executeQuery', () => {
    it('sends POST to /api/query with query and variables', async () => {
      const response: QueryApiResponse = { data: { repo: null } }
      mockRequest.mockResolvedValue(response)

      const result = await executeQuery('query { repo }', { id: 'x' })

      expect(mockRequest).toHaveBeenCalledTimes(1)
      expect(mockRequest).toHaveBeenCalledWith({
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
      mockRequest.mockResolvedValue(response)

      const result = await executeQuery('query GetArtefacts { repo { ref { file { artefacts { symbolFqn } } } } }', {})

      expect(result).toEqual(response)
      expect(result.data).toEqual(response.data)
    })

    it('resolves with response including errors when API returns partial success', async () => {
      const response: QueryApiResponse = {
        data: { repo: { ref: null } },
        errors: [{ message: "Ref 'main' not found." }],
      }
      mockRequest.mockResolvedValue(response)

      const result = await executeQuery('query { repo { ref { name } } }', {})

      expect(result.data).toEqual(response.data)
      expect(result.errors).toHaveLength(1)
      expect(result.errors?.[0].message).toBe("Ref 'main' not found.")
    })

    it('rejects when request fails', async () => {
      const error = new Error('Network error')
      mockRequest.mockRejectedValue(error)

      await expect(executeQuery('query { }', {})).rejects.toThrow('Network error')
    })
  })
})
