import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SidebarProvider } from '@/components/ui/sidebar'
import { DashboardView } from '@/features/dashboard/dashboard-view'
import {
  commitData,
  type Checkpoint,
  type CommitData,
} from '@/features/dashboard/data/mock-commit-data'
import type { ApiCheckpointDetailResponse } from '@/api/types/schema'

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
