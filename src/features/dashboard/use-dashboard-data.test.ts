import { act, renderHook, waitFor } from '@testing-library/react'
import type { ApiAgentDto } from '@/api/types/schema/models/ApiAgentDto'
import type { ApiBranchSummaryDto } from '@/api/types/schema/models/ApiBranchSummaryDto'
import type { ApiCommitRowDto } from '@/api/types/schema/models/ApiCommitRowDto'
import type { ApiUserDto } from '@/api/types/schema/models/ApiUserDto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDashboardData } from './use-dashboard-data'

const mockRequest = vi.fn()

const mockHandleCheckpoint = vi.fn()

vi.mock('@/api/types/schema', () => ({
  BitloopsCli: vi.fn(function MockBitloopsCli() {
    return {
      request: { request: mockRequest },
      default: { handleApiCheckpoint: mockHandleCheckpoint },
    }
  }),
}))

function minimalCommitRow(overrides?: {
  checkpointId?: string
}): ApiCommitRowDto {
  const checkpointId = overrides?.checkpointId ?? 'abcd1234abcd'
  return {
    checkpoint: {
      agent: 'claude-code',
      agents: ['claude-code'],
      branch: 'main',
      checkpoint_id: checkpointId,
      checkpoints_count: 1,
      created_at: '2025-01-15T14:30:00.000Z',
      files_touched: [],
      is_task: false,
      session_count: 1,
      session_id: 'session-1',
      strategy: 'default',
      tool_use_id: 'tool-1',
    },
    commit: {
      author_email: 'dev@example.com',
      author_name: 'Dev',
      message: 'fix: sample',
      parents: [],
      sha: 'a1b2c3d4e5f6789012345678901234567890abcd',
      timestamp: 1_738_000_000,
    },
  }
}

function defaultBranchList(): ApiBranchSummaryDto[] {
  return [{ branch: '  main  ', checkpoint_commits: 3 }]
}

function defaultUsers(): ApiUserDto[] {
  return [{ key: 'user-1', name: 'Ada', email: 'ada@example.com' }]
}

function defaultAgents(): ApiAgentDto[] {
  return [{ key: 'claude-code' }]
}

describe('useDashboardData', () => {
  beforeEach(() => {
    mockRequest.mockReset()
    mockHandleCheckpoint.mockReset()
    mockRequest.mockImplementation((params) => {
      switch (params.url) {
        case '/api/branches':
          return Promise.resolve(defaultBranchList())
        case '/api/users':
          return Promise.resolve(defaultUsers())
        case '/api/agents':
          return Promise.resolve(defaultAgents())
        case '/api/commits':
          return Promise.resolve([minimalCommitRow()])
        default:
          return Promise.reject(new Error(`unexpected url: ${params.url}`))
      }
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
  })

  it('loads commits and exposes mapped rows when a branch is effective', async () => {
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.rows.length).toBe(1)
      expect(result.current.rows[0]?.commit).toBe('a1b2c3d')
      expect(result.current.dataSource).toBe('api')
    })

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/api/branches',
        query: { from: null, to: null },
      }),
    )
  })

  it('sets optionsSource to error when branch request fails', async () => {
    mockRequest.mockImplementation((params) => {
      if (params.url === '/api/branches') {
        return Promise.reject(new Error('network'))
      }
      return Promise.resolve([])
    })

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.optionsSource).toBe('error')
    })
  })

  it('sets dataSource and optionsSource to error when dashboard data request fails', async () => {
    mockRequest.mockImplementation((params) => {
      if (params.url === '/api/branches') {
        return Promise.resolve(defaultBranchList())
      }
      return Promise.reject(new Error('fail'))
    })

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.dataSource).toBe('error')
      expect(result.current.optionsSource).toBe('error')
    })
  })

  it('keeps visible rows empty when there is no effective branch', async () => {
    mockRequest.mockImplementation((params) => {
      if (params.url === '/api/branches') {
        return Promise.resolve([])
      }
      return Promise.reject(new Error('should not call'))
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
})
