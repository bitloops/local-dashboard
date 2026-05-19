import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchDashboardCheckpointDetail,
  subscribeDashboardInteractionUpdates,
} from '@/features/dashboard/graphql/fetch-dashboard-data'
import type { DashboardInteractionSessionDto } from '@/features/dashboard/api-types'
import { rootStoreInstance } from '@/store'
import { runDashboardQueryExplorerQuery } from './run-dashboard-query'
import { SessionsView } from './sessions-view'

vi.mock('@/components/layout/header', () => ({
  Header: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/layout/main', () => ({
  Main: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

vi.mock('@/components/theme-switch', () => ({
  ThemeSwitch: () => <div data-testid='theme-switch' />,
}))

vi.mock('@/components/ui/use-sidebar', () => ({
  useSidebar: () => ({
    setOpen: vi.fn(),
    setRightOpen: vi.fn(),
  }),
}))

vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
  SidebarRail: () => null,
}))

vi.mock('@/features/query-explorer/hooks/use-resize-width', () => ({
  useResizeWidth: () => [780, vi.fn()],
}))

vi.mock('@/features/query-explorer/components/query-explorer', () => ({
  QueryExplorerLayout: ({
    leftPanel,
    rightPanel,
  }: {
    leftPanel: ReactNode
    rightPanel: ReactNode
  }) => (
    <div>
      <div>{leftPanel}</div>
      <div>{rightPanel}</div>
    </div>
  ),
}))

vi.mock(
  '@/features/query-explorer/components/editor-history-container',
  () => ({
    EditorHistoryContainer: ({
      runQuery,
    }: {
      runQuery?: (overrides?: {
        query: string
        variables: string
      }) => Promise<void>
    }) => (
      <button type='button' onClick={() => void runQuery?.()}>
        Run query
      </button>
    ),
  }),
)

vi.mock('@/features/sessions/components/sessions-variables-panel', () => ({
  SessionsVariablesPanel: () => <div data-testid='sessions-variables-panel' />,
}))

vi.mock('@/features/sessions/components/sessions-repo-branch-filters', () => ({
  SessionsRepoBranchFilters: ({
    onResolvedRepoIdChange,
  }: {
    onResolvedRepoIdChange: (repoId: string | null) => void
  }) => {
    useEffect(() => {
      onResolvedRepoIdChange('repo-1')
    }, [onResolvedRepoIdChange])

    return <div data-testid='sessions-repo-branch-filters' />
  },
}))

vi.mock('@/features/dashboard/components/sessions-table', () => ({
  SessionsTable: () => <div data-testid='sessions-table' />,
}))

vi.mock('@/features/sessions/components/sessions-checkpoints-table', () => ({
  SessionsCheckpointsTable: () => (
    <div data-testid='sessions-checkpoints-table' />
  ),
}))

vi.mock('@/features/dashboard/components/session-detail-sidebar', () => ({
  SessionDetailSidebar: ({
    sessionId,
    refreshToken,
  }: {
    sessionId: string | null
    refreshToken?: number
  }) => (
    <div
      data-testid='session-detail-sidebar'
      data-session-id={sessionId ?? ''}
      data-refresh-token={String(refreshToken ?? 0)}
    />
  ),
}))

vi.mock('@/features/dashboard/components/checkpoint-sheet', () => ({
  CheckpointSheet: () => <div data-testid='checkpoint-sheet' />,
}))

vi.mock('@/features/dashboard/graphql/fetch-dashboard-data', () => ({
  fetchDashboardCheckpointDetail: vi.fn(),
  subscribeDashboardInteractionUpdates: vi.fn(),
}))

vi.mock('./run-dashboard-query', () => ({
  runDashboardQueryExplorerQuery: vi.fn(),
}))

vi.mock('./use-sessions-result-sync', () => ({
  useSessionsResultSync: () => undefined,
}))

const mockFetchDashboardCheckpointDetail = vi.mocked(
  fetchDashboardCheckpointDetail,
)
const mockSubscribeDashboardInteractionUpdates = vi.mocked(
  subscribeDashboardInteractionUpdates,
)
const mockRunDashboardQueryExplorerQuery = vi.mocked(
  runDashboardQueryExplorerQuery,
)

function renderView() {
  return render(<SessionsView />)
}

function latestSubscriptionHandlers() {
  const handlers = mockSubscribeDashboardInteractionUpdates.mock.lastCall?.[1]
  expect(handlers).toBeDefined()
  return handlers!
}

function interactionUpdate(
  overrides: Partial<{
    turn_count: number
    latest_session_updated_at: string
    latest_turn_id: string
    latest_turn_updated_at: string
  }> = {},
) {
  return {
    repo_id: 'repo-1',
    session_count: 1,
    turn_count: overrides.turn_count ?? 1,
    latest_session_id: 'session-1',
    latest_session_updated_at:
      overrides.latest_session_updated_at ?? '2026-05-19T10:00:00.000Z',
    latest_turn_id: overrides.latest_turn_id ?? 'turn-1',
    latest_turn_updated_at:
      overrides.latest_turn_updated_at ?? '2026-05-19T10:00:00.000Z',
  }
}

function makeSessionRow(
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
    started_at: '2026-05-19T09:00:00.000Z',
    ended_at: null,
    last_event_at: '2026-05-19T09:05:00.000Z',
    turn_count: 1,
    checkpoint_count: 0,
    token_usage: null,
    file_paths: [],
    tool_uses: [],
    linked_checkpoints: [],
    latest_commit_author: null,
    ...overrides,
  }
}

describe('SessionsView', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    const state = rootStoreInstance.getState()
    state.clearDashboardCache()
    state.resetDashboardFilters()
    state.clearRunHistory()
    state.setSessionsLandingDefaultsApplied(false)
    state.setQuery('query { stale }')
    state.setVariables('{"repoId":"stale"}')
    state.setVariablesHaveErrors(false)
    state.setResult({ status: 'idle' })
    mockFetchDashboardCheckpointDetail.mockResolvedValue({
      checkpoint_id: 'cp-1',
      strategy: 'default',
      branch: 'main',
      checkpoints_count: 1,
      files_touched: [],
      session_count: 0,
      token_usage: null,
      sessions: [],
    })
    mockSubscribeDashboardInteractionUpdates.mockImplementation(() => () => {})
    mockRunDashboardQueryExplorerQuery.mockResolvedValue()
  })

  it('ignores the priming subscription update and refreshes on the next change', async () => {
    renderView()

    await waitFor(() => {
      expect(mockRunDashboardQueryExplorerQuery).toHaveBeenCalledTimes(1)
      expect(mockSubscribeDashboardInteractionUpdates).toHaveBeenCalledTimes(1)
    })

    const handlers = latestSubscriptionHandlers()

    act(() => {
      handlers.onUpdate(interactionUpdate())
    })

    expect(mockRunDashboardQueryExplorerQuery).toHaveBeenCalledTimes(1)

    act(() => {
      handlers.onUpdate(
        interactionUpdate({
          turn_count: 2,
          latest_session_updated_at: '2026-05-19T10:05:00.000Z',
          latest_turn_id: 'turn-2',
          latest_turn_updated_at: '2026-05-19T10:05:00.000Z',
        }),
      )
    })

    await waitFor(() => {
      expect(mockRunDashboardQueryExplorerQuery).toHaveBeenCalledTimes(2)
    })
  })

  it('bumps the session detail refresh token only when the selected session row key changes', async () => {
    renderView()

    const initialSelected = makeSessionRow('session-1', {
      last_event_at: '2026-05-19T10:00:00.000Z',
      turn_count: 1,
    })
    const unrelated = makeSessionRow('session-2', {
      last_event_at: '2026-05-19T10:01:00.000Z',
      turn_count: 1,
    })

    act(() => {
      const state = rootStoreInstance.getState()
      state.setSessionRows([initialSelected, unrelated])
      state.setSelectedSessionId('session-1')
      state.setSelectedSessionSummary(initialSelected)
    })

    await waitFor(() => {
      expect(screen.getByTestId('session-detail-sidebar')).toHaveAttribute(
        'data-session-id',
        'session-1',
      )
    })
    expect(screen.getByTestId('session-detail-sidebar')).toHaveAttribute(
      'data-refresh-token',
      '0',
    )

    act(() => {
      rootStoreInstance.getState().setSessionRows([
        initialSelected,
        {
          ...unrelated,
          last_event_at: '2026-05-19T10:02:00.000Z',
          turn_count: 2,
        },
      ])
    })

    expect(screen.getByTestId('session-detail-sidebar')).toHaveAttribute(
      'data-refresh-token',
      '0',
    )

    act(() => {
      rootStoreInstance.getState().setSessionRows([
        {
          ...initialSelected,
          last_event_at: '2026-05-19T10:03:00.000Z',
          turn_count: 2,
        },
        unrelated,
      ])
    })

    await waitFor(() => {
      expect(screen.getByTestId('session-detail-sidebar')).toHaveAttribute(
        'data-refresh-token',
        '1',
      )
    })

    act(() => {
      rootStoreInstance.getState().setSessionRows([
        {
          ...initialSelected,
          last_event_at: '2026-05-19T10:03:00.000Z',
          turn_count: 2,
          ended_at: '2026-05-19T10:04:00.000Z',
        },
        unrelated,
      ])
    })

    await waitFor(() => {
      expect(screen.getByTestId('session-detail-sidebar')).toHaveAttribute(
        'data-refresh-token',
        '2',
      )
    })

    act(() => {
      const state = rootStoreInstance.getState()
      state.setSelectedSessionId('session-2')
      state.setSelectedSessionSummary(unrelated)
    })

    await waitFor(() => {
      expect(screen.getByTestId('session-detail-sidebar')).toHaveAttribute(
        'data-session-id',
        'session-2',
      )
    })
    expect(screen.getByTestId('session-detail-sidebar')).toHaveAttribute(
      'data-refresh-token',
      '2',
    )
  })

  it('falls back to polling when the interaction subscription errors', async () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)

    renderView()

    await waitFor(() => {
      expect(mockRunDashboardQueryExplorerQuery).toHaveBeenCalledTimes(1)
      expect(mockSubscribeDashboardInteractionUpdates).toHaveBeenCalledTimes(1)
    })

    vi.useFakeTimers()

    act(() => {
      latestSubscriptionHandlers().onError?.(new Error('ws unavailable'))
    })

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Sessions interaction subscription unavailable; falling back to polling',
      expect.any(Error),
    )

    await act(async () => {
      vi.advanceTimersByTime(30_000)
      await Promise.resolve()
    })

    expect(mockRunDashboardQueryExplorerQuery).toHaveBeenCalledTimes(2)
  })
})
