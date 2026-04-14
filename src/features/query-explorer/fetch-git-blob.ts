import {
  fetchDashboardBlob,
  fetchDashboardRepositoriesCached,
} from '@/api/dashboard/client'
import { GraphQLRequestError } from '@/api/graphql/errors'

export class GitBlobFetchError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'GitBlobFetchError'
    this.status = status
    this.code = code
  }
}

export type FetchGitBlobParams = {
  repo: string
  blobSha: string
  signal?: AbortSignal
}

/**
 * Fetches raw git blob bytes from the dashboard REST API (same origin as the bundle).
 */
export async function fetchGitBlob({
  repo,
  blobSha,
  signal,
}: FetchGitBlobParams): Promise<ArrayBuffer> {
  try {
    const repositories = await fetchDashboardRepositoriesCached({ signal })
    const repoId = repositories.find((repository) => repository.identity === repo)?.repoId

    if (!repoId) {
      throw new GitBlobFetchError(
        `Repository '${repo}' is not available for blob preview.`,
        404,
        'repo_not_found',
      )
    }

    return await fetchDashboardBlob(repoId, blobSha, { signal })
  } catch (error) {
    if (error instanceof GitBlobFetchError) {
      throw error
    }
    if (error instanceof GraphQLRequestError) {
      throw new GitBlobFetchError(
        error.message,
        error.status ?? 500,
      )
    }
    throw error
  }
}
