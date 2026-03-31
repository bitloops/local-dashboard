import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestGraphQL } from '@/api/graphql/client'
import {
  COMMITS_PAGE_SIZE,
  fetchDashboardCommitsPage,
  fetchDashboardRepoOptions,
} from './fetch-dashboard-data'

vi.mock('@/api/graphql/client', () => ({
  requestGraphQL: vi.fn(),
}))

const mockRequestGraphQL = vi.mocked(requestGraphQL)

function commitNode(sha: string) {
  return {
    sha,
    parents: [] as string[],
    authorName: 'Dev',
    authorEmail: 'dev@example.com',
    commitMessage: 'msg',
    committedAt: '2025-01-01T00:00:00.000Z',
    filesChanged: [] as string[],
    checkpoints: { edges: [] as { node: { id: string } }[] },
  }
}

describe('fetchDashboardCommitsPage', () => {
  beforeEach(() => {
    mockRequestGraphQL.mockReset()
  })

  it('requests one page with after and commitsFirst', async () => {
    mockRequestGraphQL.mockResolvedValue({
      data: {
        repo: {
          commits: {
            pageInfo: { hasNextPage: false, endCursor: null },
            edges: [{ node: commitNode('aaa') }],
          },
        },
      },
    })

    const data = await fetchDashboardCommitsPage({
      repo: '',
      branch: 'main',
      since: null,
      until: null,
      author: null,
      after: null,
    })

    expect(mockRequestGraphQL).toHaveBeenCalledTimes(1)
    expect(mockRequestGraphQL.mock.calls[0]?.[1]).toMatchObject({
      repo: '',
      branch: 'main',
      after: null,
      commitsFirst: COMMITS_PAGE_SIZE,
      commitsLast: undefined,
    })
    expect(data.repo?.commits.edges).toHaveLength(1)
  })

  it('requests a previous page with before and commitsLast', async () => {
    mockRequestGraphQL.mockResolvedValue({
      data: {
        repo: {
          commits: {
            pageInfo: {
              hasNextPage: true,
              hasPreviousPage: false,
              startCursor: 'cursor-1',
              endCursor: 'cursor-2',
            },
            edges: [{ node: commitNode('bbb') }],
          },
        },
      },
    })

    await fetchDashboardCommitsPage({
      direction: 'backward',
      repo: '',
      branch: 'main',
      since: null,
      until: null,
      author: null,
      before: 'cursor-1',
    })

    expect(mockRequestGraphQL.mock.calls[0]?.[1]).toMatchObject({
      repo: '',
      branch: 'main',
      before: 'cursor-1',
      commitsLast: COMMITS_PAGE_SIZE,
      commitsFirst: undefined,
    })
  })

  it('returns repo null when the response has no repo', async () => {
    mockRequestGraphQL.mockResolvedValue({ data: { repo: null } })

    const data = await fetchDashboardCommitsPage({
      repo: '',
      branch: 'main',
      since: null,
      until: null,
      author: null,
      after: null,
    })

    expect(data.repo).toBeNull()
  })

  it('throws when GraphQL returns errors', async () => {
    mockRequestGraphQL.mockResolvedValue({
      errors: [{ message: 'bad' }],
      data: { repo: null },
    })

    await expect(
      fetchDashboardCommitsPage({
        repo: '',
        branch: 'main',
        since: null,
        until: null,
        author: null,
        after: null,
      }),
    ).rejects.toThrow('bad')
  })
})

describe('fetchDashboardRepoOptions', () => {
  beforeEach(() => {
    mockRequestGraphQL.mockReset()
  })

  it('returns users and agents from repo', async () => {
    mockRequestGraphQL.mockResolvedValue({
      data: {
        repo: {
          users: ['a@b.com'],
          agents: ['agent-a'],
        },
      },
    })

    const data = await fetchDashboardRepoOptions({
      repo: '',
    })

    expect(data.repo?.users).toEqual(['a@b.com'])
    expect(data.repo?.agents).toEqual(['agent-a'])
  })

  it('throws when GraphQL returns errors', async () => {
    mockRequestGraphQL.mockResolvedValue({
      errors: [{ message: 'repo not found' }],
      data: { repo: null },
    })

    await expect(fetchDashboardRepoOptions({ repo: '' })).rejects.toThrow(
      'repo not found',
    )
  })
})
