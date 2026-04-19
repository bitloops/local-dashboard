import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SidebarProvider } from '@/components/ui/sidebar'
import { DashboardView } from '@/features/dashboard/dashboard-view'
import type {
  DashboardInteractionSessionDto,
  DashboardRepositoryOption,
} from '@/features/dashboard/api-types'
import { type CommitData } from '@/features/dashboard/types'

vi.mock('@/features/dashboard/components/session-activity-chart', () => ({
  CommitCheckpointChart: () => <div data-testid='session-activity-chart' />,
}))

vi.mock('@/features/dashboard/components/session-detail-sidebar', () => ({
  SessionDetailSidebar: ({ sessionId }: { sessionId: string | null }) =>
    sessionId ? (
      <div data-testid='session-sidebar'>sidebar-{sessionId}</div>
    ) : null,
}))

const commitData: CommitData[] = [
  {
    date: 'Feb 14',
    commit: 'a3f1c2d',
    checkpoints: 4,
    message: 'feat: add dashboard layout scaffold',
    agent: 'claude-code',
    checkpointList: [
      {
        id: 'cp-01',
        prompt: 'Create the basic layout with sidebar and header',
        firstPromptPreview: 'Create the basic layout with sidebar and header',
        timestamp: '10:12 AM',
      },
    ],
  },
]

const sessionSample: DashboardInteractionSessionDto = {
  session_id: 'sess-1',
  branch: 'main',
  actor: null,
  agent_type: 'claude-code',
  model: null,
  first_prompt: 'Build the dashboard session view',
  started_at: '2025-02-14T10:00:00.000Z',
  ended_at: null,
  last_event_at: null,
  turn_count: 3,
  checkpoint_count: 4,
  token_usage: null,
  file_paths: [],
  tool_uses: [],
  linked_checkpoints: [],
  latest_commit_author: null,
}

function renderDashboard(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<SidebarProvider>{ui}</SidebarProvider>)
}

function defaultProps(
  overrides: Partial<React.ComponentProps<typeof DashboardView>> = {},
) {
  const rows = overrides.rows ?? commitData.slice(0, 1)
  const sessionRows = overrides.sessionRows ?? [sessionSample]
  const repoOptions: DashboardRepositoryOption[] = [
    {
      repoId: 'repo-1',
      identity: 'bitloops/local-dashboard',
      name: 'local-dashboard',
      organization: 'bitloops',
      provider: 'github',
      defaultBranch: 'main',
    },
  ]
  return {
    rows,
    sessionRows,
    repoOptions,
    hasAnyRepositories: repoOptions.length > 0,
    hasAnyAutoSelectableRepositories: repoOptions.length > 0,
    hasDashboardScope: true,
    branchOptions: ['main'],
    userOptions: [{ label: 'You', value: 'you' }],
    agentOptions: ['claude-code', 'gemini-cli'],
    selectedRepoId: null,
    effectiveRepoId: null,
    selectedBranch: null,
    selectedUser: null,
    selectedAgent: null,
    effectiveRepoIdentity: 'bitloops/local-dashboard',
    fromDate: undefined,
    toDate: undefined,
    effectiveBranch: 'main',
    dataSource: 'api' as const,
    optionsSource: 'api' as const,
    branchOptionsSource: 'api' as const,
    sessionsHasNextPage: false,
    sessionsHasPreviousPage: false,
    onSessionsNext: () => {},
    onSessionsBack: () => {},
    selectedSessionId: null,
    selectedSessionSummary: null,
    sessionDetailRefreshToken: 0,
    onRepoChange: () => {},
    onBranchChange: () => {},
    onUserChange: () => {},
    onAgentChange: () => {},
    onFromDateChange: () => {},
    onToDateChange: () => {},
    onClearFilters: () => {},
    onSessionSelect: () => {},
    ...overrides,
  }
}

describe('Dashboard integration', () => {
  it('renders dashboard with sessions table when data is provided', () => {
    renderDashboard(<DashboardView {...defaultProps()} />)
    expect(
      screen.getByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Recent Sessions')).toBeInTheDocument()
    expect(
      screen.getByText(sessionSample.first_prompt ?? ''),
    ).toBeInTheDocument()
  })

  it('shows error message when dataSource is error', () => {
    renderDashboard(
      <DashboardView {...defaultProps({ dataSource: 'error' })} />,
    )
    expect(
      screen.getByText(/Could not load dashboard data from the dashboard API/),
    ).toBeInTheDocument()
  })

  it('shows the empty repositories banner only when the repositories list is empty', () => {
    renderDashboard(
      <DashboardView
        {...defaultProps({
          repoOptions: [],
          effectiveRepoId: null,
          effectiveRepoIdentity: null,
        })}
        hasAnyRepositories={false}
        hasAnyAutoSelectableRepositories={false}
      />,
    )

    expect(
      screen.getByText(/No repositories are currently available from the dashboard API/),
    ).toBeInTheDocument()
  })

  it('shows a retry banner when repositories exist but none are auto-selectable', () => {
    renderDashboard(
      <DashboardView
        {...defaultProps({
          effectiveRepoId: null,
          effectiveRepoIdentity: null,
        })}
        hasAnyRepositories
        hasAnyAutoSelectableRepositories={false}
      />,
    )

    expect(
      screen.getByText(/auto mode could not find an available repository/i),
    ).toBeInTheDocument()
  })

  it('shows session sidebar when a session is selected', () => {
    renderDashboard(
      <DashboardView
        {...defaultProps({
          selectedSessionId: 'sess-1',
          selectedSessionSummary: sessionSample,
        })}
      />,
    )
    expect(screen.getByTestId('session-sidebar')).toHaveTextContent(
      'sidebar-sess-1',
    )
  })

  it('calls onSessionSelect when user clicks a session row', async () => {
    const onSessionSelect = vi.fn()
    renderDashboard(
      <DashboardView {...defaultProps({ onSessionSelect })} />,
    )
    await userEvent.click(
      screen.getByText(sessionSample.first_prompt ?? ''),
    )
    expect(onSessionSelect).toHaveBeenCalledTimes(1)
    expect(onSessionSelect).toHaveBeenCalledWith(sessionSample)
  })

  it('renders filters section with repo, branch, user, agent, and date controls', () => {
    renderDashboard(<DashboardView {...defaultProps()} />)
    expect(screen.getByText('Filters')).toBeInTheDocument()
    expect(screen.getByText('Repo')).toBeInTheDocument()
    expect(screen.getAllByText('Branch').length).toBeGreaterThan(0)
    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getAllByText('Agent').length).toBeGreaterThan(0)
  })
})
