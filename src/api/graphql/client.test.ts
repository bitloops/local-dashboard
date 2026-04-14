import { afterEach, describe, expect, it, vi } from 'vitest'
import { GraphQLRequestError } from './errors'
import { fetchGraphQLSdl, requestGraphQL } from './client'

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

describe('requestGraphQL', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('posts the query payload and returns parsed data', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: {
          viewer: {
            id: 'user-1',
          },
        },
      }),
    )
    const signal = new AbortController().signal

    const result = await requestGraphQL<{ viewer: { id: string } }>(
      'query Viewer { viewer { id } }',
      undefined,
      { signal },
    )

    expect(fetchSpy).toHaveBeenCalledWith(
      '/devql/global',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          query: 'query Viewer { viewer { id } }',
          variables: {},
        }),
        signal,
      }),
    )
    expect(result).toEqual({
      data: {
        viewer: {
          id: 'user-1',
        },
      },
    })
  })

  it('preserves GraphQL errors on failed responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        {
          errors: [{ message: 'Schema unavailable' }],
        },
        503,
      ),
    )

    await expect(
      requestGraphQL<{ viewer: { id: string } }, { repoId: string }>(
        'query Viewer($repoId: ID!) { viewer(repoId: $repoId) { id } }',
        { repoId: 'repo-1' },
      ),
    ).rejects.toMatchObject<Partial<GraphQLRequestError>>({
      name: 'GraphQLRequestError',
      message: 'Schema unavailable',
      status: 503,
      graphQLErrors: [{ message: 'Schema unavailable' }],
    })
  })

  it('falls back to the HTTP status when a failed response has no GraphQL errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        {
          data: null,
        },
        502,
      ),
    )

    await expect(
      requestGraphQL('query Viewer { viewer { id } }'),
    ).rejects.toMatchObject<Partial<GraphQLRequestError>>({
      message: 'Request failed (502).',
      status: 502,
    })
  })

  it('throws a clear error when the response body is not valid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not-json', {
        status: 500,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )

    await expect(
      requestGraphQL('query Viewer { viewer { id } }'),
    ).rejects.toMatchObject<Partial<GraphQLRequestError>>({
      message: 'Invalid GraphQL response payload.',
      status: 500,
    })
  })
})

describe('fetchGraphQLSdl', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads the schema SDL as plain text', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('type Query { viewer: ID! }', {
        status: 200,
      }),
    )
    const signal = new AbortController().signal

    await expect(fetchGraphQLSdl({ signal })).resolves.toBe(
      'type Query { viewer: ID! }',
    )
    expect(fetchSpy).toHaveBeenCalledWith('/devql/global/sdl', {
      method: 'GET',
      signal,
    })
  })

  it('includes the HTTP status when SDL loading fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('unavailable', {
        status: 503,
      }),
    )

    await expect(fetchGraphQLSdl()).rejects.toMatchObject<
      Partial<GraphQLRequestError>
    >({
      message: 'Failed to load schema SDL (503).',
      status: 503,
    })
  })
})
