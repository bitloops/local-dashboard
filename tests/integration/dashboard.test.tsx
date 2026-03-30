import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SidebarProvider } from '@/components/ui/sidebar'
import { DashboardView } from '@/features/dashboard/dashboard-view'
import { type Checkpoint, type CommitData } from '@/features/dashboard/types'
import type { ApiCheckpointDetailResponse } from '@/api/rest'

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
      {
        id: 'cp-02',
        prompt: 'Add responsive breakpoints for mobile',
        firstPromptPreview: 'Add responsive breakpoints for mobile',
        timestamp: '10:28 AM',
      },
      {
        id: 'cp-03',
        prompt: 'Wire up the theme provider',
        firstPromptPreview: 'Wire up the theme provider',
        timestamp: '10:45 AM',
      },
      {
        id: 'cp-04',
        prompt: 'Fix sidebar collapse animation',
        firstPromptPreview: 'Fix sidebar collapse animation',
        timestamp: '11:03 AM',
      },
    ],
  },
  {
    date: 'Feb 15',
    commit: 'b7e9a01',
    checkpoints: 7,
    message: 'fix: resolve auth token refresh loop',
    agent: 'claude-code',
    checkpointList: [
      {
        id: 'cp-05',
        prompt: 'Investigate the infinite refresh issue',
        firstPromptPreview: 'Investigate the infinite refresh issue',
        timestamp: '09:15 AM',
      },
      {
        id: 'cp-06',
        prompt: 'Add token expiry check before refresh',
        firstPromptPreview: 'Add token expiry check before refresh',
        timestamp: '09:32 AM',
      },
      {
        id: 'cp-07',
        prompt: 'Handle 401 responses in query cache',
        firstPromptPreview: 'Handle 401 responses in query cache',
        timestamp: '09:48 AM',
      },
      {
        id: 'cp-08',
        prompt: 'Add retry backoff for failed refreshes',
        firstPromptPreview: 'Add retry backoff for failed refreshes',
        timestamp: '10:05 AM',
      },
      {
        id: 'cp-09',
        prompt: 'Write unit test for token refresh',
        firstPromptPreview: 'Write unit test for token refresh',
        timestamp: '10:22 AM',
      },
      {
        id: 'cp-10',
        prompt: 'Fix race condition in concurrent requests',
        firstPromptPreview: 'Fix race condition in concurrent requests',
        timestamp: '10:40 AM',
      },
      {
        id: 'cp-11',
        prompt: 'Clean up error handling',
        firstPromptPreview: 'Clean up error handling',
        timestamp: '10:55 AM',
      },
    ],
  },
  {
    date: 'Feb 16',
    commit: 'c4d2f88',
    checkpoints: 2,
    message: 'chore: update dependencies to latest',
    agent: 'gemini-cli',
    checkpointList: [
      {
        id: 'cp-12',
        prompt: 'Update all packages to latest versions',
        firstPromptPreview: 'Update all packages to latest versions',
        timestamp: '02:10 PM',
      },
      {
        id: 'cp-13',
        prompt: 'Fix breaking changes from React 19 update',
        firstPromptPreview: 'Fix breaking changes from React 19 update',
        timestamp: '02:35 PM',
      },
    ],
  },
]

function renderDashboard(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<SidebarProvider>{ui}</SidebarProvider>)
}

function defaultProps(
  overrides: Partial<{
    rows: CommitData[]
    dataSource: 'loading' | 'api' | 'error'
    optionsSource: 'loading' | 'api' | 'error'
    selectedCheckpoint: Checkpoint | null
    checkpointDetail: ApiCheckpointDetailResponse | null
    checkpointDetailSource: 'idle' | 'loading' | 'api' | 'error'
    onCheckpointSelect: (checkpoint: Checkpoint) => void
    onCheckpointClose: () => void
  }> = {},
) {
  const rows = overrides.rows ?? commitData.slice(0, 3)
  return {
    rows,
    branchOptions: ['main'],
    userOptions: [{ label: 'You', value: 'you' }],
    agentOptions: ['claude-code', 'gemini-cli'],
    selectedBranch: null,
    selectedUser: null,
    selectedAgent: null,
    fromDate: undefined,
    toDate: undefined,
    effectiveBranch: 'main',
    dataSource: 'api' as const,
    optionsSource: 'api' as const,
    commitsHasNextPage: false,
    commitsHasPreviousPage: false,
    onCommitsNext: () => {},
    onCommitsBack: () => {},
    selectedCheckpoint: null,
    checkpointDetail: null,
    checkpointDetailSource: 'idle' as const,
    onBranchChange: () => {},
    onUserChange: () => {},
    onAgentChange: () => {},
    onFromDateChange: () => {},
    onToDateChange: () => {},
    onClearFilters: () => {},
    onCheckpointSelect: () => {},
    onCheckpointClose: () => {},
    ...overrides,
  }
}

describe('Dashboard integration', () => {
  it('renders dashboard with table rows when data is provided', () => {
    renderDashboard(<DashboardView {...defaultProps()} />)
    expect(
      screen.getByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Recent Commits')).toBeInTheDocument()
    const firstMessage = commitData[0].message
    expect(screen.getByText(firstMessage)).toBeInTheDocument()
  })

  it('shows error message when dataSource is error', () => {
    renderDashboard(
      <DashboardView {...defaultProps({ dataSource: 'error' })} />,
    )
    expect(
      screen.getByText(/Could not load dashboard data from the API/),
    ).toBeInTheDocument()
  })

  it('opens checkpoint sheet when a checkpoint is selected', () => {
    const rows = commitData.slice(0, 1)
    const cp = rows[0].checkpointList[0]
    renderDashboard(
      <DashboardView
        {...defaultProps({
          rows,
          selectedCheckpoint: cp,
          checkpointDetailSource: 'api',
        })}
      />,
    )
    expect(screen.getByText(`Checkpoint ${cp.id}`)).toBeInTheDocument()
  })

  it('calls onCheckpointSelect with checkpoint when user clicks checkpoint in commit list', async () => {
    const rows = commitData.slice(0, 1)
    const cp = rows[0].checkpointList[0]
    const onCheckpointSelect = vi.fn()
    renderDashboard(
      <DashboardView
        {...defaultProps({
          rows,
          onCheckpointSelect,
        })}
      />,
    )
    const expandButton = screen.getByRole('button', { name: /expand row/i })
    await userEvent.click(expandButton)
    const promptPreview = cp.firstPromptPreview?.trim() || `Checkpoint ${cp.id}`
    const checkpointButton = screen.getByRole('button', {
      name: new RegExp(
        promptPreview.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      ),
    })
    await userEvent.click(checkpointButton)
    expect(onCheckpointSelect).toHaveBeenCalledTimes(1)
    expect(onCheckpointSelect).toHaveBeenCalledWith(cp)
  })

  it('shows loading message in right sidebar when checkpoint is selected and detail is loading', () => {
    const rows = commitData.slice(0, 1)
    const cp = rows[0].checkpointList[0]
    renderDashboard(
      <DashboardView
        {...defaultProps({
          rows,
          selectedCheckpoint: cp,
          checkpointDetailSource: 'loading',
        })}
      />,
    )
    expect(screen.getByText(`Checkpoint ${cp.id}`)).toBeInTheDocument()
    expect(
      screen.getByText(/Loading chat data for this checkpoint/),
    ).toBeInTheDocument()
  })

  it('shows transcript entries when checkpoint detail has sessions with transcript', () => {
    const rows = commitData.slice(0, 1)
    const cp = rows[0].checkpointList[0]
    const checkpointDetail: ApiCheckpointDetailResponse = {
      branch: 'main',
      checkpoint_id: cp.id,
      checkpoints_count: 1,
      files_touched: [],
      session_count: 1,
      strategy: '',
      sessions: [
        {
          agent: 'claude-code',
          context_text: '',
          created_at: '2025-03-04T12:00:00Z',
          is_task: false,
          metadata_json: '{}',
          prompts_text: cp.firstPromptPreview ?? cp.prompt ?? '',
          session_id: 's1',
          session_index: 0,
          tool_use_id: '',
          transcript_jsonl: [
            JSON.stringify({
              type: 'user',
              message: { content: 'Hello' },
              timestamp: '2025-03-04T12:00:00Z',
              uuid: 'u1',
            }),
            JSON.stringify({
              type: 'assistant',
              message: { content: [{ type: 'text', text: 'Hi there' }] },
              timestamp: '2025-03-04T12:00:01Z',
              uuid: 'a1',
            }),
          ].join('\n'),
        },
      ],
    }
    renderDashboard(
      <DashboardView
        {...defaultProps({
          rows,
          selectedCheckpoint: cp,
          checkpointDetail,
          checkpointDetailSource: 'api',
        })}
      />,
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Hi there')).toBeInTheDocument()
  })

  it('shows checkpoint detail error when checkpointDetailSource is error', () => {
    const rows = commitData.slice(0, 1)
    const cp = rows[0].checkpointList[0]
    renderDashboard(
      <DashboardView
        {...defaultProps({
          rows,
          selectedCheckpoint: cp,
          checkpointDetailSource: 'error',
        })}
      />,
    )
    expect(
      screen.getByText(/Could not load chat data from/),
    ).toBeInTheDocument()
  })

  it('renders filters section with branch, user, agent, and date controls', () => {
    renderDashboard(<DashboardView {...defaultProps()} />)
    expect(screen.getByText('Filters')).toBeInTheDocument()
    expect(screen.getByText('Branch')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getAllByText('Agent').length).toBeGreaterThan(0)
  })
})
