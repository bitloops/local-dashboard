import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchDashboardBlob,
  fetchDashboardRepositoriesCached,
} from '@/api/dashboard/client'
import { GraphQLRequestError } from '@/api/graphql/errors'
import { fetchGitBlob, GitBlobFetchError } from './fetch-git-blob'

vi.mock('@/api/dashboard/client', () => ({
  fetchDashboardBlob: vi.fn(),
  fetchDashboardRepositoriesCached: vi.fn(),
}))

const mockFetchDashboardBlob = vi.mocked(fetchDashboardBlob)
const mockFetchDashboardRepositoriesCached = vi.mocked(
  fetchDashboardRepositoriesCached,
)

describe('fetchGitBlob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves the repo identity to repoId before fetching blob bytes', async () => {
    const bytes = new ArrayBuffer(3)
    mockFetchDashboardRepositoriesCached.mockResolvedValue([
      {
        repoId: 'repo-1',
        identity: 'acme/demo',
        name: 'demo',
        provider: 'github',
        organization: 'acme',
        defaultBranch: 'main',
      },
    ])
    mockFetchDashboardBlob.mockResolvedValue(bytes)

    await expect(
      fetchGitBlob({ repo: 'acme/demo', blobSha: 'abc123' }),
    ).resolves.toBe(bytes)

    expect(mockFetchDashboardBlob).toHaveBeenCalledWith('repo-1', 'abc123', {
      signal: undefined,
    })
  })

  it('fails with a clear repo_not_found error when the repo identity is unknown', async () => {
    mockFetchDashboardRepositoriesCached.mockResolvedValue([
      {
        repoId: 'repo-1',
        identity: 'acme/demo',
        name: 'demo',
        provider: 'github',
        organization: 'acme',
        defaultBranch: 'main',
      },
    ])

    await expect(
      fetchGitBlob({ repo: 'missing/repo', blobSha: 'abc123' }),
    ).rejects.toMatchObject<Partial<GitBlobFetchError>>({
      name: 'GitBlobFetchError',
      status: 404,
      code: 'repo_not_found',
      message: "Repository 'missing/repo' is not available for blob preview.",
    })

    expect(mockFetchDashboardBlob).not.toHaveBeenCalled()
  })

  it('wraps dashboard transport failures as GitBlobFetchError', async () => {
    mockFetchDashboardRepositoriesCached.mockRejectedValue(
      new GraphQLRequestError('Dashboard offline', { status: 503 }),
    )

    await expect(
      fetchGitBlob({ repo: 'acme/demo', blobSha: 'abc123' }),
    ).rejects.toMatchObject<Partial<GitBlobFetchError>>({
      name: 'GitBlobFetchError',
      status: 503,
      message: 'Dashboard offline',
    })
  })
})
