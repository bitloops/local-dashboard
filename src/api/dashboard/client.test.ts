import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GraphQLRequestError } from '@/api/graphql/errors'
import {
  clearDashboardRepositoriesCache,
  fetchDashboardBlob,
  fetchDashboardRepositoriesCached,
  requestDashboardGraphQL,
  subscribeDashboardGraphQL,
} from './client'

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

async function flushMicrotasks(times = 3) {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve()
  }
}

class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: MockWebSocket[] = []

  readonly url: string
  readonly protocols: string[]
  readonly sent: string[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  readyState = MockWebSocket.CONNECTING
  closedWith: { code?: number; reason?: string } | null = null

  private listeners = new Map<
    string,
    Set<(event: Event | MessageEvent | CloseEvent) => void>
  >()

  constructor(url: string, protocols?: string | string[]) {
    this.url = url
    this.protocols =
      protocols == null
        ? []
        : Array.isArray(protocols)
          ? protocols
          : [protocols]
    MockWebSocket.instances.push(this)
  }

  addEventListener(
    type: string,
    listener: (event: Event | MessageEvent | CloseEvent) => void,
  ) {
    const handlers = this.listeners.get(type) ?? new Set()
    handlers.add(listener)
    this.listeners.set(type, handlers)
  }

  removeEventListener(
    type: string,
    listener: (event: Event | MessageEvent | CloseEvent) => void,
  ) {
    this.listeners.get(type)?.delete(listener)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED
    this.closedWith = { code, reason }
    this.emit(
      'close',
      new CloseEvent('close', {
        code,
        reason,
        wasClean: code === 1000,
      }),
    )
  }

  emitOpen() {
    this.readyState = MockWebSocket.OPEN
    this.emit('open', new Event('open'))
  }

  emitMessage(payload: unknown) {
    this.emit(
      'message',
      new MessageEvent('message', {
        data: JSON.stringify(payload),
      }),
    )
  }

  emitClose(code?: number, reason?: string, wasClean = false) {
    this.readyState = MockWebSocket.CLOSED
    this.closedWith = { code, reason }
    this.emit(
      'close',
      new CloseEvent('close', {
        code,
        reason,
        wasClean,
      }),
    )
  }

  private emit(type: string, event: Event | MessageEvent | CloseEvent) {
    if (type === 'open') {
      this.onopen?.(event as Event)
    } else if (type === 'message') {
      this.onmessage?.(event as MessageEvent)
    } else if (type === 'close') {
      this.onclose?.(event as CloseEvent)
    } else if (type === 'error') {
      this.onerror?.(event as Event)
    }

    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }
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
    const expectedError: Partial<GraphQLRequestError> = {
      name: 'GraphQLRequestError',
      message: 'Dashboard unavailable',
      status: 503,
      graphQLErrors: [{ message: 'Dashboard unavailable' }],
    }

    await expect(
      requestDashboardGraphQL('query Dashboard { repositories { repoId } }'),
    ).rejects.toMatchObject(expectedError)
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
    const expectedError: Partial<GraphQLRequestError> = {
      message: 'Request failed (500).',
      status: 500,
    }

    await expect(
      requestDashboardGraphQL('query Dashboard { repositories { repoId } }'),
    ).rejects.toMatchObject(expectedError)
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
    const expectedError: Partial<GraphQLRequestError> = {
      message: 'Invalid dashboard GraphQL response payload.',
      status: 502,
    }

    await expect(
      requestDashboardGraphQL('query Dashboard { repositories { repoId } }'),
    ).rejects.toMatchObject(expectedError)
  })

  it('preserves AbortError when dashboard response parsing is cancelled', async () => {
    const abortedResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(
        new DOMException('The operation was aborted.', 'AbortError'),
      ),
    } as unknown as Response

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(abortedResponse)

    await expect(
      requestDashboardGraphQL('query Dashboard { repositories { repoId } }'),
    ).rejects.toMatchObject({
      name: 'AbortError',
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
    const expectedError: Partial<GraphQLRequestError> = {
      message: 'Blob not found',
      status: 404,
    }

    await expect(fetchDashboardBlob('repo-1', 'blob-1')).rejects.toMatchObject(
      expectedError,
    )
  })

  it('falls back to the HTTP status when blob errors are not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('bad gateway', {
        status: 502,
      }),
    )
    const expectedError: Partial<GraphQLRequestError> = {
      message: 'Request failed (502).',
      status: 502,
    }

    await expect(fetchDashboardBlob('repo-1', 'blob-1')).rejects.toMatchObject(
      expectedError,
    )
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
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
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
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
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
    const expectedError: Partial<GraphQLRequestError> = {
      message: 'Repositories failed to load',
      graphQLErrors: [{ message: 'Repositories failed to load' }],
    }

    await expect(fetchDashboardRepositoriesCached()).rejects.toMatchObject(
      expectedError,
    )

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

describe('subscribeDashboardGraphQL', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('connects over websocket and forwards dashboard subscription payloads', async () => {
    const onData = vi.fn()
    const onError = vi.fn()
    const unsubscribe = subscribeDashboardGraphQL(
      'subscription DashboardInteractionUpdates { interactionUpdates { repoId } }',
      { repoId: 'repo-1' },
      { onData, onError },
    )

    const socket = MockWebSocket.instances[0]
    expect(socket).toBeDefined()

    const expectedUrl = new URL('/devql/dashboard/ws', window.location.origin)
    expectedUrl.protocol =
      expectedUrl.protocol === 'https:' ? 'wss:' : 'ws:'

    expect(socket?.url).toBe(expectedUrl.toString())
    expect(socket?.protocols).toEqual(['graphql-transport-ws'])

    socket?.emitOpen()
    expect(socket?.sent[0]).toBe(JSON.stringify({ type: 'connection_init' }))

    socket?.emitMessage({ type: 'connection_ack' })
    await flushMicrotasks()
    const subscribeMessage = JSON.parse(socket?.sent[1] ?? '{}') as {
      id?: string
      type?: string
      payload?: {
        query?: string
        variables?: Record<string, unknown>
      }
    }

    expect(subscribeMessage).toMatchObject({
      type: 'subscribe',
      payload: {
        query:
          'subscription DashboardInteractionUpdates { interactionUpdates { repoId } }',
        variables: {
          repoId: 'repo-1',
        },
      },
    })
    expect(typeof subscribeMessage.id).toBe('string')

    socket?.emitMessage({
      type: 'next',
      id: subscribeMessage.id,
      payload: {
        data: {
          interactionUpdates: {
            repoId: 'repo-1',
          },
        },
      },
    })
    await flushMicrotasks()

    expect(onData).toHaveBeenCalledWith({
      interactionUpdates: {
        repoId: 'repo-1',
      },
    })
    expect(onError).not.toHaveBeenCalled()

    unsubscribe()

    expect(JSON.parse(socket?.sent[2] ?? '{}')).toEqual({
      id: subscribeMessage.id,
      type: 'complete',
    })
  })

  it('stops retrying when the socket keeps closing before the GraphQL handshake completes', async () => {
    vi.useFakeTimers()

    const onError = vi.fn()

    subscribeDashboardGraphQL(
      'subscription DashboardInteractionUpdates { interactionUpdates { repoId } }',
      { repoId: 'repo-1' },
      { onData: vi.fn(), onError },
    )

    const socket = MockWebSocket.instances[0]
    expect(socket).toBeDefined()

    socket?.emitClose(1006)
    await flushMicrotasks()

    await vi.advanceTimersByTimeAsync(1_000)
    expect(MockWebSocket.instances).toHaveLength(2)

    MockWebSocket.instances[1]?.emitClose(1006)
    await flushMicrotasks()

    await vi.advanceTimersByTimeAsync(2_000)
    expect(MockWebSocket.instances).toHaveLength(3)

    MockWebSocket.instances[2]?.emitClose(1006)
    await flushMicrotasks()

    await vi.advanceTimersByTimeAsync(5_000)
    expect(MockWebSocket.instances).toHaveLength(4)

    MockWebSocket.instances[3]?.emitClose(1006)
    await flushMicrotasks()

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Dashboard subscription closed (1006).',
      }),
    )

    await vi.advanceTimersByTimeAsync(10_000)

    expect(MockWebSocket.instances).toHaveLength(4)
  })

  it('reconnects when an acknowledged subscription closes', async () => {
    vi.useFakeTimers()

    const unsubscribe = subscribeDashboardGraphQL(
      'subscription DashboardInteractionUpdates { interactionUpdates { repoId } }',
      { repoId: 'repo-1' },
      { onData: vi.fn(), onError: vi.fn() },
    )

    const firstSocket = MockWebSocket.instances[0]
    expect(firstSocket).toBeDefined()

    firstSocket?.emitOpen()
    firstSocket?.emitMessage({ type: 'connection_ack' })
    firstSocket?.emitClose(1012, 'service restart')

    await vi.advanceTimersByTimeAsync(1_000)

    expect(MockWebSocket.instances).toHaveLength(2)

    unsubscribe()
  })
})
