import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { COMMITS_PAGE_SIZE } from './graphql/fetch-dashboard-data'
import { useDashboardData } from './use-dashboard-data'
import { rootStoreInstance } from '@/store'

const mockRequestGraphQL = vi.fn()

const mockHandleCheckpoint = vi.fn()

vi.mock('@/api/graphql/client', () => ({
  requestGraphQL: (query: string, variables: Record<string, unknown>) =>
    mockRequestGraphQL(query, variables),
}))

vi.mock('@/api/rest', () => ({
  BitloopsCli: vi.fn(function MockBitloopsCli() {
    return {
      default: { handleApiCheckpoint: mockHandleCheckpoint },
    }
  }),
}))

function dashboardCommitsResponse() {
  return {
    data: {
      repo: {
        commits: {
          pageInfo: { hasNextPage: false, endCursor: null },
          edges: [
            {
              node: {
                sha: 'a1b2c3d4e5f6789012345678901234567890abcd',
                parents: [],
                authorName: 'Dev',
                authorEmail: 'dev@example.com',
                commitMessage: 'fix: sample',
                committedAt: '2025-01-15T14:30:00.000Z',
                filesChanged: [],
                checkpoints: {
                  edges: [
                    {
                      node: {
                        id: 'abcd1234abcd',
                        branch: 'main',
                        agent: 'claude-code',
                        strategy: 'default',
                        filesTouched: [],
                        checkpointsCount: 1,
                        sessionCount: 1,
                        sessionId: 'session-1',
                        agents: ['claude-code'],
                        firstPromptPreview: '',
                        createdAt: '2025-01-15T14:30:00.000Z',
                        isTask: false,
                        toolUseId: 'tool-1',
                        tokenUsage: null,
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    },
  }
}

describe('useDashboardData', () => {
  beforeEach(() => {
    mockRequestGraphQL.mockReset()
    mockHandleCheckpoint.mockReset()
    rootStoreInstance.getState().resetDashboardCommitsPagination()
    mockRequestGraphQL.mockImplementation((query: string) => {
      if (query.includes('query DashboardBranches')) {
        return Promise.resolve({
          data: {
            repo: {
              branches: [{ name: '  main  ', checkpointCount: 3 }],
            },
          },
        })
      }
      if (query.includes('query DashboardRepoOptions')) {
        return Promise.resolve({
          data: {
            repo: {
              users: ['user-1'],
              agents: ['claude-code'],
            },
          },
        })
      }
      if (query.includes('query DashboardCommits')) {
        return Promise.resolve(dashboardCommitsResponse())
      }
      return Promise.reject(new Error('unexpected GraphQL query'))
    })
    mockHandleCheckpoint.mockResolvedValue({
      branch: 'main',
      checkpoint_id: 'abcd1234abcd',
      checkpoints_count: 1,
      files_touched: [],
      session_count: 1,
      sessions: [],
      strategy: 'default',
    })
  })

  it('loads branch list and sets effectiveBranch to first branch', async () => {
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.branchOptions).toEqual(['main'])
      expect(result.current.effectiveBranch).toBe('main')
      expect(result.current.optionsSource).toBe('api')
    })

    const branchCalls = mockRequestGraphQL.mock.calls.filter((call) =>
      String(call[0]).includes('query DashboardBranches'),
    )
    expect(branchCalls[0]?.[1]).toMatchObject({
      repo: '',
      since: null,
      until: null,
    })
  })

  it('loads commits and exposes mapped rows when a branch is effective', async () => {
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.rows.length).toBe(1)
      expect(result.current.rows[0]?.commit).toBe('a1b2c3d')
      expect(result.current.dataSource).toBe('api')
    })

    expect(mockRequestGraphQL).toHaveBeenCalled()
    const commitsCalls = mockRequestGraphQL.mock.calls.filter((call) =>
      String(call[0]).includes('query DashboardCommits'),
    )
    expect(commitsCalls[0]?.[1]).toMatchObject({
      author: null,
      after: null,
      commitsFirst: COMMITS_PAGE_SIZE,
    })
  })

  it('passes author to DashboardCommits when a user is selected', async () => {
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => expect(result.current.effectiveBranch).toBe('main'))

    mockRequestGraphQL.mockClear()

    act(() => {
      result.current.onUserChange('dev@example.com')
    })

    await waitFor(() => {
      const commitsCalls = mockRequestGraphQL.mock.calls.filter((call) =>
        String(call[0]).includes('query DashboardCommits'),
      )
      expect(
        commitsCalls.some((call) => call[1]?.author === 'dev@example.com'),
      ).toBe(true)
    })
  })

  it('sets optionsSource to error when branch request fails', async () => {
    mockRequestGraphQL.mockImplementation((query: string) => {
      if (query.includes('query DashboardBranches')) {
        return Promise.reject(new Error('network'))
      }
      return Promise.resolve({ data: { repo: null } })
    })

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.optionsSource).toBe('error')
    })
  })

  it('sets dataSource to error when commits request fails', async () => {
    mockRequestGraphQL.mockImplementation((query: string) => {
      if (query.includes('query DashboardBranches')) {
        return Promise.resolve({
          data: { repo: { branches: [{ name: 'main', checkpointCount: 3 }] } },
        })
      }
      if (query.includes('query DashboardRepoOptions')) {
        return Promise.resolve({
          data: { repo: { users: [], agents: [] } },
        })
      }
      if (query.includes('query DashboardCommits')) {
        return Promise.reject(new Error('fail'))
      }
      return Promise.reject(new Error('unexpected'))
    })

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.dataSource).toBe('error')
      expect(result.current.optionsSource).toBe('api')
    })
  })

  it('keeps visible rows empty when there is no effective branch', async () => {
    mockRequestGraphQL.mockImplementation((query: string) => {
      if (query.includes('query DashboardBranches')) {
        return Promise.resolve({
          data: { repo: { branches: [] } },
        })
      }
      if (query.includes('query DashboardRepoOptions')) {
        return Promise.resolve({
          data: { repo: { users: [], agents: [] } },
        })
      }
      return Promise.reject(new Error('unexpected GraphQL query'))
    })

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.branchOptions).toEqual([])
      expect(result.current.effectiveBranch).toBeNull()
    })

    expect(result.current.rows).toEqual([])
    expect(result.current.dataSource).toBe('api')
  })

  it('clearFilters resets branch, user, agent, and date filters', async () => {
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => expect(result.current.effectiveBranch).toBe('main'))

    act(() => {
      result.current.onBranchChange('main')
      result.current.onUserChange('user-1')
      result.current.onAgentChange('claude-code')
      result.current.onFromDateChange(new Date('2025-02-01'))
      result.current.onToDateChange(new Date('2025-02-28'))
    })

    act(() => {
      result.current.onClearFilters()
    })

    expect(result.current.selectedBranch).toBeNull()
    expect(result.current.selectedUser).toBeNull()
    expect(result.current.selectedAgent).toBeNull()
    expect(result.current.fromDate).toBeUndefined()
    expect(result.current.toDate).toBeUndefined()
  })

  it('onFromDateChange moves toDate forward when from is after to', async () => {
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => expect(result.current.effectiveBranch).toBe('main'))

    const from = new Date('2025-06-10')
    const to = new Date('2025-06-05')

    act(() => {
      result.current.onToDateChange(to)
    })
    act(() => {
      result.current.onFromDateChange(from)
    })

    expect(result.current.fromDate?.toDateString()).toBe(from.toDateString())
    expect(result.current.toDate?.toDateString()).toBe(from.toDateString())
  })

  it('onToDateChange moves fromDate back when to is before from', async () => {
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => expect(result.current.effectiveBranch).toBe('main'))

    const from = new Date('2025-06-10')
    const to = new Date('2025-06-05')

    act(() => {
      result.current.onFromDateChange(from)
    })
    act(() => {
      result.current.onToDateChange(to)
    })

    expect(result.current.toDate?.toDateString()).toBe(to.toDateString())
    expect(result.current.fromDate?.toDateString()).toBe(to.toDateString())
  })

  it('loads checkpoint detail after first checkpoint is auto-selected', async () => {
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() =>
      expect(result.current.selectedCheckpoint?.id).toBe('abcd1234abcd'),
    )

    await waitFor(() => {
      expect(mockHandleCheckpoint).toHaveBeenCalledWith({
        checkpointId: 'abcd1234abcd',
      })
      expect(result.current.checkpointDetailSource).toBe('api')
      expect(result.current.checkpointDetail?.checkpoint_id).toBe(
        'abcd1234abcd',
      )
    })
  })

  it('onCheckpointSelect requests detail for the new checkpoint', async () => {
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => expect(result.current.rows.length).toBe(1))

    mockHandleCheckpoint.mockClear()

    const cp = result.current.rows[0]!.checkpointList[0]!

    act(() => {
      result.current.onCheckpointSelect(cp)
    })

    expect(result.current.checkpointDetailSource).toBe('loading')

    await waitFor(() => {
      expect(mockHandleCheckpoint).toHaveBeenCalledWith({
        checkpointId: cp.id,
      })
    })
  })

  it('resets selectedCheckpoint to first available when current selection disappears from rows', async () => {
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() =>
      expect(result.current.selectedCheckpoint?.id).toBe('abcd1234abcd'),
    )

    const newCheckpointId = 'beef5678beef'
    mockRequestGraphQL.mockImplementation((query: string) => {
      if (query.includes('query DashboardBranches')) {
        return Promise.resolve({
          data: { repo: { branches: [{ name: 'main', checkpointCount: 3 }] } },
        })
      }
      if (query.includes('query DashboardRepoOptions')) {
        return Promise.resolve({
          data: { repo: { users: ['user-1'], agents: ['claude-code'] } },
        })
      }
      if (query.includes('query DashboardCommits')) {
        return Promise.resolve({
          data: {
            repo: {
              commits: {
                pageInfo: { hasNextPage: false, endCursor: null },
                edges: [
                  {
                    node: {
                      sha: 'a1b2c3d4e5f6789012345678901234567890abcd',
                      parents: [],
                      authorName: 'Dev',
                      authorEmail: 'dev@example.com',
                      commitMessage: 'fix: sample',
                      committedAt: '2025-01-15T14:30:00.000Z',
                      filesChanged: [],
                      checkpoints: {
                        edges: [
                          {
                            node: {
                              id: newCheckpointId,
                              branch: 'main',
                              agent: 'claude-code',
                              strategy: 'default',
                              filesTouched: [],
                              checkpointsCount: 1,
                              sessionCount: 1,
                              sessionId: 'session-1',
                              agents: ['claude-code'],
                              firstPromptPreview: '',
                              createdAt: '2025-01-15T14:30:00.000Z',
                              isTask: false,
                              toolUseId: 'tool-1',
                              tokenUsage: null,
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        })
      }
      return Promise.reject(new Error('unexpected GraphQL query'))
    })
    mockHandleCheckpoint.mockClear()

    expect(result.current.userOptions.length).toBeGreaterThan(0)
    const selectedUserValue = result.current.userOptions[0]!.value
    act(() => {
      result.current.onUserChange(selectedUserValue)
    })

    await waitFor(() => {
      expect(result.current.selectedCheckpoint?.id).toBe(newCheckpointId)
    })
  })

  it('sets checkpointDetailSource to error when handleApiCheckpoint rejects', async () => {
    mockHandleCheckpoint.mockRejectedValue(new Error('server error'))

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() =>
      expect(result.current.selectedCheckpoint?.id).toBe('abcd1234abcd'),
    )

    await waitFor(() => {
      expect(result.current.checkpointDetailSource).toBe('error')
      expect(result.current.checkpointDetail).toBeNull()
    })
  })

  it('clears selected checkpoint detail when refreshed rows contain no checkpoints', async () => {
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() =>
      expect(result.current.selectedCheckpoint?.id).toBe('abcd1234abcd'),
    )
    await waitFor(() => {
      expect(result.current.checkpointDetailSource).toBe('api')
    })

    mockRequestGraphQL.mockImplementation((query: string) => {
      if (query.includes('query DashboardBranches')) {
        return Promise.resolve({
          data: { repo: { branches: [{ name: 'main', checkpointCount: 3 }] } },
        })
      }
      if (query.includes('query DashboardRepoOptions')) {
        return Promise.resolve({
          data: { repo: { users: [], agents: [] } },
        })
      }
      if (query.includes('query DashboardCommits')) {
        return Promise.resolve({
          data: {
            repo: {
              commits: {
                pageInfo: { hasNextPage: false, endCursor: null },
                edges: [],
              },
            },
          },
        })
      }
      return Promise.reject(new Error('unexpected GraphQL query'))
    })

    act(() => {
      result.current.onUserChange('user-1')
    })

    await waitFor(() => {
      expect(result.current.selectedCheckpoint).toBeNull()
      expect(result.current.checkpointDetail).toBeNull()
      expect(result.current.checkpointDetailSource).toBe('idle')
    })
  })
})
