import { GraphQLRequestError } from '@/api/graphql/errors'
import type {
  GraphQLRequestOptions,
  GraphQLResponseEnvelope,
} from '@/api/graphql/types'

const DASHBOARD_GRAPHQL_ENDPOINT = '/devql/dashboard'
const DASHBOARD_BLOB_ENDPOINT = '/devql/dashboard/blobs'

function resolveEndpoint(path: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(path, window.location.origin).toString()
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
  } catch {
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
