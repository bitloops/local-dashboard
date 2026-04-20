import { GraphQLRequestError } from '@/api/graphql/errors'
import { createClient } from 'graphql-ws'
import type { FormattedExecutionResult } from 'graphql-ws'
import type {
  GraphQLErrorItem,
  GraphQLRequestOptions,
  GraphQLResponseEnvelope,
} from '@/api/graphql/types'

const DASHBOARD_GRAPHQL_ENDPOINT = '/devql/dashboard'
const DASHBOARD_BLOB_ENDPOINT = '/devql/dashboard/blobs'
const DASHBOARD_GRAPHQL_WS_ENDPOINT = '/devql/dashboard/ws'
const GRAPHQL_WS_RETRY_DELAYS_MS = [1_000, 2_000, 5_000] as const

function resolveEndpoint(path: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(path, window.location.origin).toString()
  }

  return path
}

function resolveWebSocketEndpoint(path: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const url = new URL(path, window.location.origin)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return url.toString()
  }

  return path
}

export type DashboardRepositoryRecord = {
  repoId: string
  identity: string
  name: string
  provider: string
  organization: string
  defaultBranch: string | null
}

let repositoriesCache: Promise<DashboardRepositoryRecord[]> | null = null

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

function firstGraphQLErrorMessage(
  errors: GraphQLErrorItem[] | undefined,
  fallback: string,
): string {
  return errors?.[0]?.message ?? fallback
}

function toGraphQLErrorItems(
  errors:
    | ReadonlyArray<{
        message?: string
      }>
    | undefined,
): GraphQLErrorItem[] | undefined {
  if (errors == null) {
    return undefined
  }

  const normalised = errors
    .map((item) =>
      typeof item.message === 'string' ? { message: item.message } : null,
    )
    .filter((item): item is GraphQLErrorItem => item != null)

  return normalised.length > 0 ? normalised : undefined
}

function createSubscriptionError(
  fallbackMessage: string,
  errors?: GraphQLErrorItem[],
): GraphQLRequestError {
  return new GraphQLRequestError(
    firstGraphQLErrorMessage(errors, fallbackMessage),
    { graphQLErrors: errors },
  )
}

function isCloseEventLike(
  value: unknown,
): value is { code: number; reason: string } {
  return (
    typeof value === 'object' &&
    value != null &&
    'code' in value &&
    typeof value.code === 'number' &&
    'reason' in value &&
    typeof value.reason === 'string'
  )
}

function normaliseGraphQLWsError(error: unknown): GraphQLRequestError {
  if (Array.isArray(error)) {
    const errors = error
      .map((item) =>
        item != null &&
        typeof item === 'object' &&
        'message' in item &&
        typeof item.message === 'string'
          ? { message: item.message }
          : null,
      )
      .filter((item): item is GraphQLErrorItem => item != null)

    return createSubscriptionError(
      'Dashboard subscription failed.',
      errors.length > 0 ? errors : undefined,
    )
  }

  if (isCloseEventLike(error)) {
    const reason = error.reason.trim()
    return new GraphQLRequestError(
      reason.length > 0
        ? `Dashboard subscription closed: ${reason}`
        : `Dashboard subscription closed (${error.code}).`,
    )
  }

  if (error instanceof GraphQLRequestError) {
    return error
  }

  if (error instanceof Error) {
    return new GraphQLRequestError(error.message)
  }

  return new GraphQLRequestError('Dashboard subscription failed.')
}

export function subscribeDashboardGraphQL<
  TData,
  TVariables = Record<string, unknown>,
>(
  query: string,
  variables: TVariables | undefined,
  handlers: {
    onData: (data: TData) => void
    onError?: (error: unknown) => void
  },
): () => void {
  if (typeof WebSocket === 'undefined') {
    handlers.onError?.(
      new GraphQLRequestError(
        'WebSocket is not available in this environment.',
      ),
    )
    return () => {}
  }

  const client = createClient({
    url: resolveWebSocketEndpoint(DASHBOARD_GRAPHQL_WS_ENDPOINT),
    lazy: true,
    lazyCloseTimeout: 1_000,
    retryAttempts: GRAPHQL_WS_RETRY_DELAYS_MS.length,
    retryWait: async (retries: number) => {
      const delay =
        GRAPHQL_WS_RETRY_DELAYS_MS[
          Math.min(retries, GRAPHQL_WS_RETRY_DELAYS_MS.length - 1)
        ] ??
        GRAPHQL_WS_RETRY_DELAYS_MS.at(-1) ??
        5_000
      await new Promise((resolve) => {
        window.setTimeout(resolve, delay)
      })
    },
  })

  const unsubscribe = client.subscribe<TData>(
    {
      query,
      variables: variables ?? {},
    },
    {
      next: (payload: FormattedExecutionResult<TData>) => {
        const errors = toGraphQLErrorItems(payload.errors)
        if (errors?.length) {
          handlers.onError?.(
            createSubscriptionError(
              'Dashboard subscription returned errors.',
              errors,
            ),
          )
          return
        }

        if (payload.data != null) {
          handlers.onData(payload.data)
        }
      },
      error: (error: unknown) => {
        handlers.onError?.(normaliseGraphQLWsError(error))
      },
      complete: () => {},
    },
  )

  return () => {
    unsubscribe()
    void client.dispose()
  }
}

export async function requestDashboardGraphQL<
  TData,
  TVariables = Record<string, unknown>,
>(
  query: string,
  variables?: TVariables,
  options?: GraphQLRequestOptions,
): Promise<GraphQLResponseEnvelope<TData>> {
  const response = await fetch(resolveEndpoint(DASHBOARD_GRAPHQL_ENDPOINT), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: variables ?? {},
    }),
    signal: options?.signal,
  })

  let payload: GraphQLResponseEnvelope<TData> | undefined
  try {
    payload = (await response.json()) as GraphQLResponseEnvelope<TData>
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new GraphQLRequestError(
      'Invalid dashboard GraphQL response payload.',
      {
        status: response.status,
      },
    )
  }

  if (!response.ok) {
    const firstError = payload.errors?.[0]?.message
    throw new GraphQLRequestError(
      firstError ?? `Request failed (${response.status}).`,
      {
        status: response.status,
        graphQLErrors: payload.errors,
      },
    )
  }

  return payload
}

export async function fetchDashboardBlob(
  repoId: string,
  blobSha: string,
  options?: { signal?: AbortSignal },
): Promise<ArrayBuffer> {
  const response = await fetch(
    resolveEndpoint(
      `${DASHBOARD_BLOB_ENDPOINT}/${encodeURIComponent(repoId)}/${encodeURIComponent(blobSha)}`,
    ),
    {
      method: 'GET',
      signal: options?.signal,
    },
  )

  if (response.ok) {
    return response.arrayBuffer()
  }

  let message = `Request failed (${response.status}).`
  try {
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string }
    }
    if (payload?.error?.message) {
      message = payload.error.message
    }
  } catch {
    // Ignore JSON parse errors for non-JSON responses.
  }

  throw new GraphQLRequestError(message, {
    status: response.status,
  })
}

export function clearDashboardRepositoriesCache() {
  repositoriesCache = null
}

export async function fetchDashboardRepositoriesCached(
  options?: GraphQLRequestOptions,
): Promise<DashboardRepositoryRecord[]> {
  if (repositoriesCache == null) {
    repositoriesCache = loadDashboardRepositories(options).catch((error) => {
      repositoriesCache = null
      throw error
    })
  }

  return repositoriesCache
}

async function loadDashboardRepositories(
  options?: GraphQLRequestOptions,
): Promise<DashboardRepositoryRecord[]> {
  const response = await requestDashboardGraphQL<{
    repositories: DashboardRepositoryRecord[]
  }>(
    `
      query DashboardRepositories {
        repositories {
          repoId
          identity
          name
          provider
          organization
          defaultBranch
        }
      }
    `,
    undefined,
    options,
  )

  if (response.errors?.length) {
    throw new GraphQLRequestError(response.errors[0].message, {
      graphQLErrors: response.errors,
    })
  }

  return response.data?.repositories ?? []
}
