import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GraphQLRequestError } from '@/api/graphql/errors'
import {
  clearDashboardRepositoriesCache,
  fetchDashboardBlob,
  fetchDashboardRepositoriesCached,
  requestDashboardGraphQL,
} from './client'

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

describe('requestDashboardGraphQL', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('posts dashboard queries to the resolved endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: {
          repositories: [],
        },
      }),
    )
    const signal = new AbortController().signal
    const query = 'query DashboardRepositories { repositories { repoId } }'

    const result = await requestDashboardGraphQL(query, undefined, { signal })

    expect(fetchSpy).toHaveBeenCalledWith(
      new URL('/devql/dashboard', window.location.origin).toString(),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: {},
        }),
        signal,
      }),
    )
    expect(result).toEqual({
      data: {
        repositories: [],
      },
    })
  })

  it('surfaces the first GraphQL error on failed dashboard responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        {
          errors: [{ message: 'Dashboard unavailable' }],
        },
        503,
      ),
    )

    await expect(
      requestDashboardGraphQL('query Dashboard { repositories { repoId } }'),
    ).rejects.toMatchObject<Partial<GraphQLRequestError>>({
      name: 'GraphQLRequestError',
      message: 'Dashboard unavailable',
      status: 503,
      graphQLErrors: [{ message: 'Dashboard unavailable' }],
    })
  })

  it('falls back to the HTTP status when a dashboard error response has no GraphQL errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        {
          data: null,
        },
        500,
      ),
    )

    await expect(
      requestDashboardGraphQL('query Dashboard { repositories { repoId } }'),
    ).rejects.toMatchObject<Partial<GraphQLRequestError>>({
      message: 'Request failed (500).',
      status: 500,
    })
  })

  it('throws a clear error when the dashboard response body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not-json', {
        status: 502,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )

    await expect(
      requestDashboardGraphQL('query Dashboard { repositories { repoId } }'),
    ).rejects.toMatchObject<Partial<GraphQLRequestError>>({
      message: 'Invalid dashboard GraphQL response payload.',
      status: 502,
    })
  })
})

describe('fetchDashboardBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns blob bytes from the encoded blob endpoint', async () => {
    const bytes = Uint8Array.from([1, 2, 3, 4])
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(bytes, {
        status: 200,
      }),
    )

    const result = await fetchDashboardBlob('repo/name', 'blob/sha')

    expect(fetchSpy).toHaveBeenCalledWith(
      new URL(
        '/devql/dashboard/blobs/repo%2Fname/blob%2Fsha',
        window.location.origin,
      ).toString(),
      {
        method: 'GET',
        signal: undefined,
      },
    )
    expect(Array.from(new Uint8Array(result))).toEqual([1, 2, 3, 4])
  })

  it('uses the JSON error payload message when blob loading fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        {
          error: {
            message: 'Blob not found',
          },
        },
        404,
      ),
    )

    await expect(fetchDashboardBlob('repo-1', 'blob-1')).rejects.toMatchObject<
      Partial<GraphQLRequestError>
    >({
      message: 'Blob not found',
      status: 404,
    })
  })

  it('falls back to the HTTP status when blob errors are not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('bad gateway', {
        status: 502,
      }),
    )

    await expect(fetchDashboardBlob('repo-1', 'blob-1')).rejects.toMatchObject<
      Partial<GraphQLRequestError>
    >({
      message: 'Request failed (502).',
      status: 502,
    })
  })
})

describe('fetchDashboardRepositoriesCached', () => {
  beforeEach(() => {
    clearDashboardRepositoriesCache()
  })

  afterEach(() => {
    clearDashboardRepositoriesCache()
    vi.restoreAllMocks()
  })

  it('caches repository lookups until the cache is cleared', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            repositories: [
              {
                repoId: 'repo-1',
                identity: 'acme/demo',
                name: 'demo',
                provider: 'github',
                organization: 'acme',
                defaultBranch: 'main',
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            repositories: [
              {
                repoId: 'repo-2',
                identity: 'acme/other',
                name: 'other',
                provider: 'github',
                organization: 'acme',
                defaultBranch: 'develop',
              },
            ],
          },
        }),
      )

    const first = await fetchDashboardRepositoriesCached()
    const second = await fetchDashboardRepositoriesCached()

    expect(second).toEqual(first)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    clearDashboardRepositoriesCache()

    await expect(fetchDashboardRepositoriesCached()).resolves.toEqual([
      {
        repoId: 'repo-2',
        identity: 'acme/other',
        name: 'other',
        provider: 'github',
        organization: 'acme',
        defaultBranch: 'develop',
      },
    ])
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('clears failed cache entries so the next call retries', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          errors: [{ message: 'Repositories failed to load' }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            repositories: [
              {
                repoId: 'repo-3',
                identity: 'acme/recovered',
                name: 'recovered',
                provider: 'github',
                organization: 'acme',
                defaultBranch: null,
              },
            ],
          },
        }),
      )

    await expect(fetchDashboardRepositoriesCached()).rejects.toMatchObject<
      Partial<GraphQLRequestError>
    >({
      message: 'Repositories failed to load',
      graphQLErrors: [{ message: 'Repositories failed to load' }],
    })

    await expect(fetchDashboardRepositoriesCached()).resolves.toEqual([
      {
        repoId: 'repo-3',
        identity: 'acme/recovered',
        name: 'recovered',
        provider: 'github',
        organization: 'acme',
        defaultBranch: null,
      },
    ])
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
