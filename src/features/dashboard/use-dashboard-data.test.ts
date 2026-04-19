import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rootStoreInstance } from '@/store'
import { getDefaultQueryExplorerVariables } from '@/store/slices/query-explorer'
import type {
  DashboardCheckpointDetailResponse,
  DashboardCheckpointDto,
  DashboardCommitRowDto,
  DashboardInteractionSessionDetailResponse,
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
  fetchDashboardInteractionSessionDetail,
  fetchDashboardInteractionSessionsPage,
  fetchDashboardRepositories,
  subscribeDashboardInteractionUpdates,
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
  fetchDashboardInteractionSessionDetail: vi.fn(),
  subscribeDashboardInteractionUpdates: vi.fn(),
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
const mockFetchDashboardInteractionSessionDetail = vi.mocked(
  fetchDashboardInteractionSessionDetail,
)
const mockSubscribeDashboardInteractionUpdates = vi.mocked(
  subscribeDashboardInteractionUpdates,
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
  overrides: Partial<DashboardInteractionSessionDto> = {},
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
    ...overrides,
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

function makeInteractionSessionDetail(
  sessionId: string,
): DashboardInteractionSessionDetailResponse {
  return {
    summary: makeInteractionSession(sessionId),
    turns: [],
    raw_events: [],
  }
}

function makeInteractionSessionsPage(
  rows: DashboardInteractionSessionDto[],
  overrides: Partial<{
    hasNextPage: boolean
    totalSessions: number
    userOptions: Array<{ label: string; value: string }>
    agentOptions: string[]
  }> = {},
) {
  return {
    rows,
    hasNextPage: overrides.hasNextPage ?? false,
    totalSessions: overrides.totalSessions ?? rows.length,
    userOptions: overrides.userOptions ?? [
      { label: 'Dev (dev@example.com)', value: 'dev@example.com' },
    ],
    agentOptions: overrides.agentOptions ?? ['claude-code'],
  }
}

function checkoutUnknownError(repoRef: string) {
  return new Error(`repository checkout unknown for \`${repoRef}\``)
}

describe('useDashboardData', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

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
        ...makeInteractionSessionsPage([
          makeInteractionSession(
            offset === DASHBOARD_PAGE_SIZE ? 'session-2' : 'session-a',
          ),
        ]),
        hasNextPage: offset === 0,
      }),
    )
    mockFetchDashboardCheckpointDetail.mockImplementation(
      async ({ checkpointId }) => makeCheckpointDetail(checkpointId),
    )
    mockFetchDashboardInteractionSessionDetail.mockImplementation(
      async ({ sessionId }) => makeInteractionSessionDetail(sessionId),
    )
    mockSubscribeDashboardInteractionUpdates.mockImplementation(() => () => {})
  })

  it('loads dashboard data in auto repo mode using the first available repository', async () => {
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.hasDashboardScope).toBe(true)
      expect(result.current.effectiveRepoId).toBe('repo-1')
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
        branch: null,
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

  it('rebinds a stale selected repo id by identity before loading branch data', async () => {
    const staleRepoId = 'stale-repo-id'

    rootStoreInstance.getState().setRepoOptions([
      {
        repoId: staleRepoId,
        identity: 'github://bitloops/bitloops-embeddings',
        name: 'bitloops-embeddings',
        organization: 'bitloops',
        provider: 'github',
        defaultBranch: 'main',
      },
    ])
    rootStoreInstance.getState().setSelectedRepoId(staleRepoId)

    mockFetchDashboardRepositories.mockResolvedValue([
      {
        repoId: 'e45f01fa-6cdc-4d5f-c237-59d7ac22978f',
        identity: 'github://bitloops/bitloops-embeddings',
        name: 'bitloops-embeddings',
        organization: 'bitloops',
        provider: 'github',
        defaultBranch: 'main',
      },
    ])

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.selectedRepoId).toBe(
        'e45f01fa-6cdc-4d5f-c237-59d7ac22978f',
      )
      expect(result.current.effectiveRepoIdentity).toBe(
        'github://bitloops/bitloops-embeddings',
      )
      expect(result.current.effectiveBranch).toBe('main')
      expect(result.current.sessionRows).toHaveLength(1)
      expect(result.current.dataSource).toBe('api')
    })

    expect(
      mockFetchDashboardBranches.mock.calls.some(
        ([variables]) => variables.repoId === staleRepoId,
      ),
    ).toBe(false)
    expect(
      mockFetchDashboardBranches.mock.calls.some(
        ([variables]) =>
          variables.repoId === 'e45f01fa-6cdc-4d5f-c237-59d7ac22978f',
      ),
    ).toBe(true)
    expect(
      mockFetchDashboardInteractionSessionsPage.mock.calls.some(
        ([variables]) =>
          variables.repoId === 'e45f01fa-6cdc-4d5f-c237-59d7ac22978f',
      ),
    ).toBe(true)
  })

  it('falls back to the selected repository defaultBranch when the branches query returns no rows', async () => {
    mockFetchDashboardBranches.mockResolvedValue([])

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.hasAnyRepositories).toBe(true)
    })

    act(() => {
      result.current.onRepoChange('repo-1')
    })

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

  it('loads interaction sessions in auto mode via the sole discovered repo when no branch can be resolved', async () => {
    mockFetchDashboardRepositories.mockResolvedValueOnce([
      {
        repoId: 'repo-1',
        identity: 'bitloops/local-dashboard',
        name: 'local-dashboard',
        organization: 'bitloops',
        provider: 'github',
        defaultBranch: null,
      },
    ])
    mockFetchDashboardBranches.mockResolvedValue([])

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.effectiveRepoId).toBe('repo-1')
      expect(result.current.effectiveRepoIdentity).toBe(
        'bitloops/local-dashboard',
      )
      expect(result.current.effectiveBranch).toBeNull()
      expect(result.current.sessionRows).toHaveLength(1)
      expect(result.current.rows).toEqual([])
      expect(result.current.dataSource).toBe('api')
    })

    expect(mockFetchDashboardInteractionSessionsPage).toHaveBeenCalledWith(
      {
        repoId: 'repo-1',
        branch: null,
        since: null,
        until: null,
        agent: null,
        commitAuthor: null,
        offset: 0,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(mockFetchDashboardCommitsPage).not.toHaveBeenCalled()
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

  it('falls through to the next available repo when the first auto-selected repo is unavailable', async () => {
    mockFetchDashboardBranches.mockImplementation(async ({ repoId }) => {
      if (repoId === 'repo-1') {
        throw checkoutUnknownError(repoId)
      }

      return [{ branch: 'main', checkpoint_commits: 3 }]
    })
    mockFetchDashboardUsers.mockImplementation(async ({ repoId }) => {
      if (repoId === 'repo-1') {
        throw checkoutUnknownError(repoId)
      }

      return [
        {
          key: 'dev@example.com',
          name: 'Dev',
          email: 'dev@example.com',
        },
      ]
    })
    mockFetchDashboardAgents.mockImplementation(async ({ repoId }) => {
      if (repoId === 'repo-1') {
        throw checkoutUnknownError(repoId)
      }

      return [{ key: 'claude-code' }]
    })
    mockFetchDashboardCommitsPage.mockImplementation(async ({ repoId }) => {
      if (repoId === 'repo-1') {
        throw checkoutUnknownError(repoId)
      }

      return {
        rows: [makeCommitRow('auto-sha')],
        hasNextPage: false,
      }
    })
    mockFetchDashboardInteractionSessionsPage.mockImplementation(async () =>
      makeInteractionSessionsPage(
        [
          makeInteractionSession('auto-session', {
            branch: 'main',
          }),
        ],
        {
          hasNextPage: false,
          userOptions: [
            { label: 'Dev (dev@example.com)', value: 'dev@example.com' },
          ],
        },
      ),
    )

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.repoOptions.map((repo) => repo.repoId)).toEqual([
        'repo-1',
        'repo-2',
      ])
      expect(result.current.hasAnyRepositories).toBe(true)
      expect(result.current.hasDashboardScope).toBe(true)
      expect(result.current.effectiveRepoIdentity).toBe('bitloops/another-repo')
      expect(result.current.effectiveBranch).toBe('main')
      expect(result.current.rows[0]?.message).toBe('message-auto-sha')
      expect(result.current.sessionRows[0]?.session_id).toBe('auto-session')
      expect(result.current.optionsSource).toBe('api')
      expect(result.current.dataSource).toBe('api')
    })

    expect(
      mockFetchDashboardBranches.mock.calls.some(
        ([variables]) => variables.repoId === 'repo-1',
      ),
    ).toBe(true)
    expect(
      mockFetchDashboardBranches.mock.calls.some(
        ([variables]) => variables.repoId === 'repo-2',
      ),
    ).toBe(true)
    expect(
      mockFetchDashboardCommitsPage.mock.calls.every(
        ([variables]) => variables.repoId === 'repo-2',
      ),
    ).toBe(true)
    expect(
      mockFetchDashboardInteractionSessionsPage.mock.calls.every(
        ([variables]) => variables.repoId === 'repo-2',
      ),
    ).toBe(true)
  })

  it('allows retrying a temporarily unavailable repo after reselecting it', async () => {
    const branchAttempts = new Map<string, number>()

    mockFetchDashboardBranches.mockImplementation(async ({ repoId }) => {
      if (repoId == null) {
        return [{ branch: 'main', checkpoint_commits: 3 }]
      }

      const attempt = (branchAttempts.get(repoId) ?? 0) + 1
      branchAttempts.set(repoId, attempt)

      if (repoId === 'repo-1') {
        throw checkoutUnknownError('repo-1')
      }
      if (repoId === 'repo-2' && attempt === 1) {
        throw checkoutUnknownError('repo-2')
      }

      return [{ branch: 'release', checkpoint_commits: 2 }]
    })
    mockFetchDashboardUsers.mockResolvedValue([
      {
        key: 'dev@example.com',
        name: 'Dev',
        email: 'dev@example.com',
      },
    ])
    mockFetchDashboardAgents.mockResolvedValue([{ key: 'claude-code' }])
    mockFetchDashboardCommitsPage.mockResolvedValue({
      rows: [makeCommitRow('release-sha')],
      hasNextPage: false,
    })
    mockFetchDashboardInteractionSessionsPage.mockResolvedValue(
      makeInteractionSessionsPage([
        makeInteractionSession('release-session', {
          branch: 'release',
        }),
      ]),
    )

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.hasAnyRepositories).toBe(true)
      expect(result.current.hasAnyAutoSelectableRepositories).toBe(false)
      expect(result.current.effectiveRepoIdentity).toBeNull()
      expect(result.current.repoOptions.map((repo) => repo.repoId)).toEqual([
        'repo-1',
        'repo-2',
      ])
    })

    act(() => {
      result.current.onRepoChange('repo-2')
    })

    await waitFor(() => {
      expect(result.current.selectedRepoId).toBe('repo-2')
      expect(result.current.effectiveRepoIdentity).toBe('bitloops/another-repo')
      expect(result.current.effectiveBranch).toBe('release')
      expect(result.current.rows[0]?.message).toBe('message-release-sha')
      expect(result.current.sessionRows[0]?.session_id).toBe('release-session')
      expect(result.current.hasAnyAutoSelectableRepositories).toBe(true)
    })

    expect(branchAttempts.get('repo-2')).toBe(2)
  })

  it('sets selected session id and summary when onSessionSelect is called', async () => {
    mockFetchDashboardInteractionSessionsPage.mockImplementation(
      async ({ offset }) => ({
        ...makeInteractionSessionsPage([
          makeInteractionSession(
            offset === DASHBOARD_PAGE_SIZE ? 'session-2' : 'session-a',
            { turn_count: 12, first_prompt: 'Custom prompt' },
          ),
        ]),
        hasNextPage: offset === 0,
      }),
    )

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => expect(result.current.sessionRows[0]).toBeDefined())

    const session = result.current.sessionRows[0]!

    act(() => {
      result.current.onSessionSelect(session)
    })

    expect(result.current.selectedSessionId).toBe('session-a')
    expect(result.current.selectedSessionSummary).toEqual(session)
    expect(result.current.selectedSessionSummary?.turn_count).toBe(12)
  })

  it('refreshes interaction sessions when the dashboard subscription reports changes', async () => {
    mockFetchDashboardInteractionSessionsPage.mockResolvedValueOnce(
      makeInteractionSessionsPage([makeInteractionSession('session-a')], {
        hasNextPage: true,
      }),
    )

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() =>
      expect(result.current.sessionRows[0]?.session_id).toBe('session-a'),
    )

    act(() => {
      result.current.onSessionSelect(result.current.sessionRows[0]!)
    })

    await waitFor(() => {
      expect(
        mockSubscribeDashboardInteractionUpdates.mock.calls.length,
      ).toBeGreaterThan(0)
    })

    const callCountBeforeUpdate =
      mockFetchDashboardInteractionSessionsPage.mock.calls.length
    const subscriptionHandlers =
      mockSubscribeDashboardInteractionUpdates.mock.lastCall?.[1]
    expect(subscriptionHandlers).toBeDefined()

    mockFetchDashboardInteractionSessionsPage.mockResolvedValueOnce(
      makeInteractionSessionsPage(
        [
          makeInteractionSession('session-a', {
            turn_count: 2,
            last_event_at: '2025-01-15T15:00:00.000Z',
          }),
        ],
        { hasNextPage: true },
      ),
    )

    act(() => {
      subscriptionHandlers?.onUpdate({
        repo_id: 'repo-1',
        session_count: 1,
        turn_count: 1,
        latest_session_id: 'session-a',
        latest_session_updated_at: '2025-01-15T14:30:00.000Z',
        latest_turn_id: 'turn-1',
        latest_turn_updated_at: '2025-01-15T14:30:00.000Z',
      })
      subscriptionHandlers?.onUpdate({
        repo_id: 'repo-1',
        session_count: 1,
        turn_count: 2,
        latest_session_id: 'session-a',
        latest_session_updated_at: '2025-01-15T15:00:00.000Z',
        latest_turn_id: 'turn-2',
        latest_turn_updated_at: '2025-01-15T15:00:00.000Z',
      })
    })

    await waitFor(() => {
      expect(
        mockFetchDashboardInteractionSessionsPage.mock.calls.length,
      ).toBeGreaterThan(callCountBeforeUpdate)
      expect(result.current.sessionRows[0]?.turn_count).toBe(2)
      expect(result.current.selectedSessionSummary?.turn_count).toBe(2)
      expect(result.current.sessionDetailRefreshToken).toBe(1)
    })
  })

  it('falls back to polling when the dashboard subscription is unavailable', async () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)

    mockFetchDashboardInteractionSessionsPage.mockResolvedValueOnce(
      makeInteractionSessionsPage([makeInteractionSession('session-a')], {
        hasNextPage: true,
      }),
    )

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() =>
      expect(result.current.sessionRows[0]?.session_id).toBe('session-a'),
    )
    await waitFor(() => {
      expect(
        mockSubscribeDashboardInteractionUpdates.mock.calls.length,
      ).toBeGreaterThan(0)
    })

    const subscriptionHandlers =
      mockSubscribeDashboardInteractionUpdates.mock.lastCall?.[1]
    expect(subscriptionHandlers).toBeDefined()

    vi.useFakeTimers()

    mockFetchDashboardInteractionSessionsPage.mockResolvedValueOnce(
      makeInteractionSessionsPage(
        [
          makeInteractionSession('session-a', {
            turn_count: 3,
            last_event_at: '2025-01-15T15:30:00.000Z',
          }),
        ],
        { hasNextPage: true },
      ),
    )

    act(() => {
      subscriptionHandlers?.onError?.(new Error('websocket unavailable'))
    })

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Dashboard interaction subscription unavailable; falling back to polling',
      expect.any(Error),
    )

    const fetchCallCountBeforePoll =
      mockFetchDashboardInteractionSessionsPage.mock.calls.length

    await act(async () => {
      vi.advanceTimersByTime(30_000)
      await Promise.resolve()
    })

    expect(
      mockFetchDashboardInteractionSessionsPage.mock.calls.length,
    ).toBeGreaterThan(fetchCallCountBeforePoll)
    expect(result.current.sessionRows[0]?.turn_count).toBe(3)
  })

  it('clears selected session when the repo changes', async () => {
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => expect(result.current.sessionRows[0]).toBeDefined())

    act(() => {
      result.current.onSessionSelect(result.current.sessionRows[0]!)
    })

    expect(result.current.selectedSessionId).toBe('session-a')

    act(() => {
      result.current.onRepoChange('repo-2')
    })

    expect(result.current.selectedSessionId).toBeNull()
    expect(result.current.selectedSessionSummary).toBeNull()
  })

  it('loads checkpoint detail in auto repo mode and refetches when the selection changes', async () => {
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
      result.current.onCheckpointSelect(
        result.current.rows[0]!.checkpointList[0]!,
      )
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
