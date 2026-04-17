import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rootStoreInstance } from '@/store'
import { getDefaultQueryExplorerVariables } from '@/store/slices/query-explorer'
import type {
  DashboardCheckpointDetailResponse,
  DashboardCheckpointDto,
  DashboardCommitRowDto,
  DashboardRepositoryOption,
} from './api-types'
import type { DashboardInteractionSessionDto } from './api-types'
import {
  COMMITS_PAGE_SIZE,
  DASHBOARD_PAGE_SIZE,
  fetchDashboardAgents,
  fetchDashboardBranches,
  fetchDashboardCheckpointDetail,
  fetchDashboardCommitsPage,
  fetchDashboardInteractionSessionsPage,
  fetchDashboardRepositories,
  fetchDashboardUsers,
} from './graphql/fetch-dashboard-data'
import { useDashboardData } from './use-dashboard-data'
import {
  endOfDayIso,
  endOfDayUnixSeconds,
  startOfDayIso,
  startOfDayUnixSeconds,
} from './utils'

vi.mock('./graphql/fetch-dashboard-data', () => ({
  COMMITS_PAGE_SIZE: 100,
  DASHBOARD_PAGE_SIZE: 100,
  fetchDashboardRepositories: vi.fn(),
  fetchDashboardBranches: vi.fn(),
  fetchDashboardUsers: vi.fn(),
  fetchDashboardAgents: vi.fn(),
  fetchDashboardCommitsPage: vi.fn(),
  fetchDashboardInteractionSessionsPage: vi.fn(),
  fetchDashboardCheckpointDetail: vi.fn(),
}))

const mockFetchDashboardRepositories = vi.mocked(fetchDashboardRepositories)
const mockFetchDashboardBranches = vi.mocked(fetchDashboardBranches)
const mockFetchDashboardUsers = vi.mocked(fetchDashboardUsers)
const mockFetchDashboardAgents = vi.mocked(fetchDashboardAgents)
const mockFetchDashboardCommitsPage = vi.mocked(fetchDashboardCommitsPage)
const mockFetchDashboardInteractionSessionsPage = vi.mocked(
  fetchDashboardInteractionSessionsPage,
)
const mockFetchDashboardCheckpointDetail = vi.mocked(
  fetchDashboardCheckpointDetail,
)

const repositoryOptions: DashboardRepositoryOption[] = [
  {
    repoId: 'repo-1',
    identity: 'bitloops/local-dashboard',
    name: 'local-dashboard',
    organization: 'bitloops',
    provider: 'github',
    defaultBranch: 'main',
  },
  {
    repoId: 'repo-2',
    identity: 'bitloops/another-repo',
    name: 'another-repo',
    organization: 'bitloops',
    provider: 'github',
    defaultBranch: 'release',
  },
]

function makeCheckpoint(
  checkpointId: string,
  overrides: Partial<DashboardCheckpointDto> = {},
): DashboardCheckpointDto {
  return {
    checkpoint_id: checkpointId,
    strategy: 'default',
    branch: 'main',
    checkpoints_count: 1,
    files_touched: [],
    session_count: 1,
    token_usage: null,
    session_id: `session-${checkpointId}`,
    agents: ['claude-code'],
    first_prompt_preview: `Prompt ${checkpointId}`,
    created_at: '2025-01-15T14:30:00.000Z',
    is_task: false,
    tool_use_id: `tool-${checkpointId}`,
    ...overrides,
  }
}

function makeCommitRow(
  sha: string,
  checkpoints: DashboardCheckpointDto[] = [makeCheckpoint(`cp-${sha}`)],
): DashboardCommitRowDto {
  return {
    commit: {
      sha,
      parents: [],
      author_name: 'Dev',
      author_email: 'dev@example.com',
      timestamp: 1_736_951_400,
      message: `message-${sha}`,
      files_touched: [],
    },
    checkpoint: checkpoints[0]!,
    checkpoints,
  }
}

function makeInteractionSession(
  sessionId: string,
): DashboardInteractionSessionDto {
  return {
    session_id: sessionId,
    branch: 'main',
    actor: null,
    agent_type: 'claude-code',
    model: null,
    first_prompt: `Prompt ${sessionId}`,
    started_at: '2025-01-15T14:30:00.000Z',
    ended_at: null,
    last_event_at: null,
    turn_count: 1,
    checkpoint_count: 1,
    token_usage: null,
    file_paths: [],
    tool_uses: [],
    linked_checkpoints: [],
    latest_commit_author: null,
  }
}

function makeCheckpointDetail(
  checkpointId: string,
): DashboardCheckpointDetailResponse {
  return {
    checkpoint_id: checkpointId,
    strategy: 'default',
    branch: 'main',
    checkpoints_count: 1,
    files_touched: [],
    session_count: 1,
    token_usage: null,
    sessions: [],
  }
}

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rootStoreInstance.getState().clearDashboardCache()
    rootStoreInstance.getState().resetDashboardFilters()
    rootStoreInstance
      .getState()
      .setVariables(getDefaultQueryExplorerVariables(null))

    mockFetchDashboardRepositories.mockResolvedValue(repositoryOptions)
    mockFetchDashboardBranches.mockImplementation(async ({ repoId }) =>
      repoId === 'repo-2'
        ? [{ branch: 'release', checkpoint_commits: 2 }]
        : [{ branch: '  main  ', checkpoint_commits: 3 }],
    )
    mockFetchDashboardUsers.mockResolvedValue([
      {
        key: 'dev@example.com',
        name: 'Dev',
        email: 'dev@example.com',
      },
    ])
    mockFetchDashboardAgents.mockResolvedValue([{ key: 'claude-code' }])
    mockFetchDashboardCommitsPage.mockImplementation(async ({ offset }) => ({
      rows: [
        makeCommitRow(
          offset === COMMITS_PAGE_SIZE
            ? 'bbbbbbb000000000000000000000000000000000'
            : 'aaaaaaa000000000000000000000000000000000',
        ),
      ],
      hasNextPage: offset === 0,
    }))
    mockFetchDashboardInteractionSessionsPage.mockImplementation(
      async ({ offset }) => ({
        rows: [
          makeInteractionSession(
            offset === DASHBOARD_PAGE_SIZE ? 'session-2' : 'session-a',
          ),
        ],
        hasNextPage: offset === 0,
      }),
    )
    mockFetchDashboardCheckpointDetail.mockImplementation(
      async ({ checkpointId }) => makeCheckpointDetail(checkpointId),
    )
  })

  it('loads repositories, then branch-scoped filters, then commits using repoId', async () => {
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.effectiveRepoIdentity).toBe(
        'bitloops/local-dashboard',
      )
      expect(result.current.effectiveBranch).toBe('main')
      expect(result.current.rows).toHaveLength(1)
      expect(result.current.sessionRows).toHaveLength(1)
      expect(result.current.optionsSource).toBe('api')
      expect(result.current.dataSource).toBe('api')
    })

    expect(mockFetchDashboardRepositories).toHaveBeenCalledTimes(1)
    expect(mockFetchDashboardBranches).toHaveBeenCalledWith({
      repoId: 'repo-1',
      from: null,
      to: null,
    })
    expect(mockFetchDashboardUsers).toHaveBeenCalledWith({
      repoId: 'repo-1',
      branch: 'main',
      from: null,
      to: null,
      agent: null,
    })
    expect(mockFetchDashboardAgents).toHaveBeenCalledWith({
      repoId: 'repo-1',
      branch: 'main',
      from: null,
      to: null,
      user: null,
    })
    expect(mockFetchDashboardCommitsPage).toHaveBeenCalledWith(
      {
        repoId: 'repo-1',
        branch: 'main',
        from: null,
        to: null,
        user: null,
        agent: null,
        offset: 0,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(mockFetchDashboardInteractionSessionsPage).toHaveBeenCalledWith(
      {
        repoId: 'repo-1',
        branch: 'main',
        since: null,
        until: null,
        agent: null,
        commitAuthor: null,
        offset: 0,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(rootStoreInstance.getState().variables).toBe(
      getDefaultQueryExplorerVariables('bitloops/local-dashboard', 'main'),
    )
  })

  it('resets dependent filters when the repo changes and keeps query explorer sync on repo identity', async () => {
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => expect(result.current.effectiveBranch).toBe('main'))

    act(() => {
      result.current.onBranchChange('main')
      result.current.onUserChange('dev@example.com')
      result.current.onAgentChange('claude-code')
    })

    act(() => {
      result.current.onRepoChange('repo-2')
    })

    expect(result.current.selectedRepoId).toBe('repo-2')
    expect(result.current.selectedBranch).toBeNull()
    expect(result.current.selectedUser).toBeNull()
    expect(result.current.selectedAgent).toBeNull()

    await waitFor(() => {
      expect(result.current.effectiveRepoIdentity).toBe('bitloops/another-repo')
      expect(result.current.effectiveBranch).toBe('release')
    })

    expect(rootStoreInstance.getState().variables).toBe(
      getDefaultQueryExplorerVariables('bitloops/another-repo', 'release'),
    )
    expect(
      mockFetchDashboardBranches.mock.calls.some(
        ([variables]) => variables.repoId === 'repo-2',
      ),
    ).toBe(true)
  })

  it('falls back to the repository defaultBranch when the branches query returns no rows', async () => {
    mockFetchDashboardBranches.mockResolvedValueOnce([])

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.branchOptions).toEqual([])
      expect(result.current.effectiveBranch).toBe('main')
      expect(result.current.rows).toHaveLength(1)
      expect(result.current.sessionRows).toHaveLength(1)
    })

    expect(mockFetchDashboardUsers).toHaveBeenCalledWith({
      repoId: 'repo-1',
      branch: 'main',
      from: null,
      to: null,
      agent: null,
    })
    expect(mockFetchDashboardAgents).toHaveBeenCalledWith({
      repoId: 'repo-1',
      branch: 'main',
      from: null,
      to: null,
      user: null,
    })
    expect(mockFetchDashboardCommitsPage).toHaveBeenCalledWith(
      {
        repoId: 'repo-1',
        branch: 'main',
        from: null,
        to: null,
        user: null,
        agent: null,
        offset: 0,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(mockFetchDashboardInteractionSessionsPage).toHaveBeenCalled()
    expect(rootStoreInstance.getState().variables).toBe(
      getDefaultQueryExplorerVariables('bitloops/local-dashboard', 'main'),
    )
  })

  it('sends dashboard date filters as Unix-second strings', async () => {
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => expect(result.current.effectiveBranch).toBe('main'))

    const fromDate = new Date('2025-02-01T12:00:00.000Z')
    const toDate = new Date('2025-02-03T12:00:00.000Z')
    const from = String(startOfDayUnixSeconds(fromDate))
    const to = String(endOfDayUnixSeconds(toDate))

    mockFetchDashboardBranches.mockClear()
    mockFetchDashboardUsers.mockClear()
    mockFetchDashboardAgents.mockClear()
    mockFetchDashboardCommitsPage.mockClear()
    mockFetchDashboardInteractionSessionsPage.mockClear()

    act(() => {
      result.current.onFromDateChange(fromDate)
      result.current.onToDateChange(toDate)
    })

    await waitFor(() => {
      expect(
        mockFetchDashboardBranches.mock.calls.some(
          ([variables]) => variables.from === from && variables.to === to,
        ),
      ).toBe(true)
      expect(
        mockFetchDashboardUsers.mock.calls.some(
          ([variables]) => variables.from === from && variables.to === to,
        ),
      ).toBe(true)
      expect(
        mockFetchDashboardAgents.mock.calls.some(
          ([variables]) => variables.from === from && variables.to === to,
        ),
      ).toBe(true)
      expect(
        mockFetchDashboardCommitsPage.mock.calls.some(
          ([variables]) => variables.from === from && variables.to === to,
        ),
      ).toBe(true)
      expect(
        mockFetchDashboardInteractionSessionsPage.mock.calls.some(
          ([variables]) =>
            variables.since === startOfDayIso(fromDate) &&
            variables.until === endOfDayIso(toDate),
        ),
      ).toBe(true)
    })
  })

  it('uses offset pagination for next and back', async () => {
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.sessionsHasNextPage).toBe(true)
      expect(result.current.sessionsHasPreviousPage).toBe(false)
      expect(result.current.sessionRows[0]?.session_id).toBe('session-a')
    })

    act(() => {
      result.current.onSessionsNext()
    })

    await waitFor(() => {
      expect(
        mockFetchDashboardInteractionSessionsPage.mock.calls.some(
          ([variables]) => variables.offset === DASHBOARD_PAGE_SIZE,
        ),
      ).toBe(true)
      expect(result.current.sessionsHasPreviousPage).toBe(true)
      expect(result.current.sessionRows[0]?.session_id).toBe('session-2')
    })

    act(() => {
      result.current.onSessionsBack()
    })

    await waitFor(() => {
      expect(
        mockFetchDashboardInteractionSessionsPage.mock.calls.filter(
          ([variables]) => variables.offset === 0,
        ).length,
      ).toBeGreaterThan(1)
      expect(result.current.sessionsHasPreviousPage).toBe(false)
    })
  })

  it('loads checkpoint detail with repoId and refetches when the selection changes', async () => {
    mockFetchDashboardCommitsPage.mockResolvedValue({
      rows: [
        makeCommitRow('aaaaaaa000000000000000000000000000000000', [
          makeCheckpoint('cp-1'),
          makeCheckpoint('cp-2'),
        ]),
      ],
      hasNextPage: false,
    })

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.rows[0]?.checkpointList.length).toBe(2)
    })

    expect(mockFetchDashboardCheckpointDetail).not.toHaveBeenCalled()

    act(() => {
      result.current.onCheckpointSelect(result.current.rows[0]!.checkpointList[0]!)
    })

    await waitFor(() => {
      expect(mockFetchDashboardCheckpointDetail).toHaveBeenCalledWith({
        repoId: 'repo-1',
        checkpointId: 'cp-1',
      })
      expect(result.current.selectedCheckpoint?.id).toBe('cp-1')
      expect(result.current.checkpointDetailSource).toBe('api')
    })

    mockFetchDashboardCheckpointDetail.mockClear()

    act(() => {
      result.current.onCheckpointSelect(
        result.current.rows[0]!.checkpointList[1]!,
      )
    })

    expect(result.current.checkpointDetailSource).toBe('loading')

    await waitFor(() => {
      expect(mockFetchDashboardCheckpointDetail).toHaveBeenCalledWith({
        repoId: 'repo-1',
        checkpointId: 'cp-2',
      })
      expect(result.current.selectedCheckpoint?.id).toBe('cp-2')
      expect(result.current.checkpointDetailSource).toBe('api')
    })
  })
})
