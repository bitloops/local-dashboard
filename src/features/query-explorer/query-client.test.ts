import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { DevQLSchema } from '@/store/types'
import { executeQuery, getQuerySchema } from './query-client'

const mockRequestGraphQL = vi.fn()
const mockFetchGraphQLSdl = vi.fn()

vi.mock('@/api/graphql/client', () => ({
  requestGraphQL: (query: string, variables: Record<string, unknown>) =>
    mockRequestGraphQL(query, variables),
  fetchGraphQLSdl: () => mockFetchGraphQLSdl(),
}))

describe('query-client', () => {
  beforeEach(() => {
    mockRequestGraphQL.mockReset()
    mockFetchGraphQLSdl.mockReset()
  })

  describe('executeQuery', () => {
    it('sends query and variables via shared GraphQL client', async () => {
      const response = { data: { repo: null } }
      mockRequestGraphQL.mockResolvedValue(response)

      const result = await executeQuery('query { repo }', { id: 'x' })

      expect(mockRequestGraphQL).toHaveBeenCalledTimes(1)
      expect(mockRequestGraphQL).toHaveBeenCalledWith('query { repo }', {
        id: 'x',
      })
      expect(result).toEqual(response)
    })

    it('resolves with response data when request succeeds', async () => {
      const response = {
        data: { repo: { ref: { file: { artefacts: [] } } } },
      }
      mockRequestGraphQL.mockResolvedValue(response)

      const result = await executeQuery(
        'query GetArtefacts { repo { ref { file { artefacts { symbolFqn } } } } }',
        {},
      )

      expect(result).toEqual(response)
      expect(result.data).toEqual(response.data)
    })

    it('resolves with response including errors when API returns partial success', async () => {
      const response = {
        data: { repo: { ref: null } },
        errors: [{ message: "Ref 'main' not found." }],
      }
      mockRequestGraphQL.mockResolvedValue(response)

      const result = await executeQuery('query { repo { ref { name } } }', {})

      expect(result.data).toEqual(response.data)
      expect(result.errors).toHaveLength(1)
      expect(result.errors?.[0].message).toBe("Ref 'main' not found.")
    })

    it('rejects when request fails', async () => {
      const error = new Error('Network error')
      mockRequestGraphQL.mockRejectedValue(error)

      await expect(executeQuery('query { }', {})).rejects.toThrow(
        'Network error',
      )
    })
  })

  describe('getQuerySchema', () => {
    it('loads SDL and maps it into autocomplete schema', async () => {
      const sdl = `
        type QueryRoot {
          repo(name: String!): Repository!
        }
        type Repository {
          name: String!
        }
        schema { query: QueryRoot }
      `
      mockFetchGraphQLSdl.mockResolvedValue(sdl)

      const result = await getQuerySchema()

      expect(mockFetchGraphQLSdl).toHaveBeenCalledTimes(1)
      const expected: DevQLSchema = {
        QueryRoot: {
          fields: { repo: { type: 'Repository!', args: { name: 'String!' } } },
        },
        Repository: { fields: { name: { type: 'String!' } } },
        Query: {
          fields: { repo: { type: 'Repository!', args: { name: 'String!' } } },
        },
      }
      expect(result).toEqual(expected)
    })
  })
})
