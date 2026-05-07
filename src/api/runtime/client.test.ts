import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchRuntimeGraphQLSdl,
  requestRuntimeGraphQL,
  subscribeRuntimeGraphQL,
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

describe('requestRuntimeGraphQL', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('posts runtime queries to the runtime endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: {
          runtimeDebugSnapshot: {
            repoId: 'repo-1',
          },
        },
      }),
    )
    const signal = new AbortController().signal
    const query =
      'query RuntimeDebug($repoId: String!) { runtimeDebugSnapshot(repoId: $repoId) { repoId } }'

    const result = await requestRuntimeGraphQL<
      { runtimeDebugSnapshot: { repoId: string } },
      { repoId: string }
    >(query, { repoId: 'repo-1' }, { signal })

    expect(fetchSpy).toHaveBeenCalledWith(
      new URL('/devql/runtime', window.location.origin).toString(),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: {
            repoId: 'repo-1',
          },
        }),
        signal,
      }),
    )
    expect(result).toEqual({
      data: {
        runtimeDebugSnapshot: {
          repoId: 'repo-1',
        },
      },
    })
  })

  it('surfaces the first runtime GraphQL error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        {
          errors: [{ message: 'Runtime unavailable' }],
        },
        503,
      ),
    )

    await expect(
      requestRuntimeGraphQL('query Runtime { configTargets { targetId } }'),
    ).rejects.toMatchObject({
      name: 'GraphQLRequestError',
      message: 'Runtime unavailable',
      status: 503,
      graphQLErrors: [{ message: 'Runtime unavailable' }],
    })
  })
})

describe('fetchRuntimeGraphQLSdl', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads the runtime schema SDL as plain text', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('type RuntimeQueryRoot { runtimeSnapshot: ID! }', {
        status: 200,
      }),
    )
    const signal = new AbortController().signal

    await expect(fetchRuntimeGraphQLSdl({ signal })).resolves.toBe(
      'type RuntimeQueryRoot { runtimeSnapshot: ID! }',
    )
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL('/devql/runtime/sdl', window.location.origin).toString(),
      {
        method: 'GET',
        signal,
      },
    )
  })
})

describe('subscribeRuntimeGraphQL', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('connects over the runtime websocket and forwards runtime subscription payloads', async () => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
    const onData = vi.fn()
    const onError = vi.fn()

    const unsubscribe = subscribeRuntimeGraphQL(
      'subscription RuntimeEvents($repoId: String!) { runtimeEvents(repoId: $repoId) { domain } }',
      { repoId: 'repo-1' },
      { onData, onError },
    )

    const socket = MockWebSocket.instances[0]
    expect(socket).toBeDefined()

    const expectedUrl = new URL('/devql/runtime/ws', window.location.origin)
    expectedUrl.protocol = expectedUrl.protocol === 'https:' ? 'wss:' : 'ws:'

    expect(socket?.url).toBe(expectedUrl.toString())
    expect(socket?.protocols).toEqual(['graphql-transport-ws'])

    socket?.emitOpen()
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
          'subscription RuntimeEvents($repoId: String!) { runtimeEvents(repoId: $repoId) { domain } }',
        variables: {
          repoId: 'repo-1',
        },
      },
    })

    socket?.emitMessage({
      type: 'next',
      id: subscribeMessage.id,
      payload: {
        data: {
          runtimeEvents: {
            domain: 'task_queue',
          },
        },
      },
    })
    await flushMicrotasks()

    expect(onData).toHaveBeenCalledWith({
      runtimeEvents: {
        domain: 'task_queue',
      },
    })
    expect(onError).not.toHaveBeenCalled()

    unsubscribe()
  })
})
