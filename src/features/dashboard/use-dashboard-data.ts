import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BitloopsCli,
  type ApiAgentDto,
  type ApiBranchSummaryDto,
  type ApiCheckpointDetailResponse,
  type ApiCommitRowDto,
  type ApiUserDto,
} from '@/api/types/schema'
import {
  type Checkpoint,
  type CheckpointDetailLoadState,
  type CommitData,
  type LoadState,
  type UserOption,
} from './types'
import {
  endOfDayUnixSeconds,
  mapAgentOptions,
  mapCommitRows,
  mapUserOptions,
  startOfDayUnixSeconds,
} from './utils'

export function useDashboardData() {
  const cli = useMemo(() => new BitloopsCli(), [])

  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined)
  const [toDate, setToDate] = useState<Date | undefined>(undefined)

  const [branchOptions, setBranchOptions] = useState<string[]>([])
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [agentOptions, setAgentOptions] = useState<string[]>([])
  const [rows, setRows] = useState<CommitData[]>([])
  const [selectedCheckpoint, setSelectedCheckpoint] =
    useState<Checkpoint | null>(null)
  const selectedCheckpointRef = useRef<Checkpoint | null>(null)
  const [checkpointDetail, setCheckpointDetail] =
    useState<ApiCheckpointDetailResponse | null>(null)
  const [checkpointDetailSource, setCheckpointDetailSource] =
    useState<CheckpointDetailLoadState>('idle')
  const [dataSource, setDataSource] = useState<'loading' | 'api' | 'error'>(
    'loading',
  )
  const [optionsSource, setOptionsSource] = useState<
    'loading' | 'api' | 'error'
  >('loading')

  const from = fromDate != null ? String(startOfDayUnixSeconds(fromDate)) : null
  const to = toDate != null ? String(endOfDayUnixSeconds(toDate)) : null
  const effectiveBranch = selectedBranch ?? branchOptions[0] ?? null

  useEffect(() => {
    selectedCheckpointRef.current = selectedCheckpoint
  }, [selectedCheckpoint])

  useEffect(() => {
    let cancelled = false

    cli.request
      .request<ApiBranchSummaryDto[]>({
        method: 'GET',
        url: '/api/branches',
        query: { from, to },
      })
      .then((branches) => {
        if (cancelled) {
          return
        }

        const nextBranches = branches
          .map((branch) => branch.branch.trim())
          .filter((branch): branch is string => branch.length > 0)

        setBranchOptions(nextBranches)
        setSelectedBranch((current) => {
          if (!current) {
            return null
          }

          return nextBranches.includes(current) ? current : null
        })
        setOptionsSource('api')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Failed to load branches', error)
        setOptionsSource('error')
      })

    return () => {
      cancelled = true
    }
  }, [cli, from, to])

  useEffect(() => {
    let cancelled = false

    if (!effectiveBranch) {
      return () => {
        cancelled = true
      }
    }

    Promise.all([
      cli.request.request<ApiUserDto[]>({
        method: 'GET',
        url: '/api/users',
        query: {
          branch: effectiveBranch,
          from,
          to,
          agent: selectedAgent,
        },
      }),
      cli.request.request<ApiAgentDto[]>({
        method: 'GET',
        url: '/api/agents',
        query: {
          branch: effectiveBranch,
          from,
          to,
          user: selectedUser,
        },
      }),
      cli.request.request<ApiCommitRowDto[]>({
        method: 'GET',
        url: '/api/commits',
        query: {
          branch: effectiveBranch,
          from,
          to,
          user: selectedUser,
          agent: selectedAgent,
        },
      }),
    ])
      .then(([users, agents, commitRows]) => {
        if (cancelled) {
          return
        }

        const nextUserOptions = mapUserOptions(users)
        const nextAgentOptions = mapAgentOptions(agents)

        setUserOptions(nextUserOptions)
        setSelectedUser((current) => {
          if (!current) {
            return null
          }

          return nextUserOptions.some((option) => option.value === current)
            ? current
            : null
        })

        setAgentOptions(nextAgentOptions)
        setSelectedAgent((current) => {
          if (!current) {
            return null
          }

          return nextAgentOptions.includes(current) ? current : null
        })

        const mappedRows = mapCommitRows(commitRows)
        setRows(mappedRows)

        const allCheckpoints = mappedRows.flatMap((r) => r.checkpointList)
        const firstCheckpoint = allCheckpoints[0] ?? null

        setSelectedCheckpoint((current) => {
          if (!current) {
            return firstCheckpoint
          }
          if (allCheckpoints.some((cp) => cp.id === current.id)) {
            return current
          }
          return firstCheckpoint
        })

        // Reload detail when the selection changed (or was just initialised),
        // and clear stale detail when no checkpoint remains visible.
        const prev = selectedCheckpointRef.current
        const next =
          prev && allCheckpoints.some((cp) => cp.id === prev.id)
            ? prev
            : firstCheckpoint
        if (!next && prev) {
          setCheckpointDetail(null)
          setCheckpointDetailSource('idle')
        } else if (next && next.id !== prev?.id) {
          setCheckpointDetail(null)
          setCheckpointDetailSource('loading')
        }
        setDataSource('api')
        setOptionsSource('api')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Failed to load dashboard data', error)
        setDataSource('error')
        setOptionsSource('error')
      })

    return () => {
      cancelled = true
    }
  }, [cli, effectiveBranch, from, to, selectedAgent, selectedUser])

  useEffect(() => {
    let cancelled = false

    if (!selectedCheckpoint || checkpointDetailSource !== 'loading') {
      return () => {
        cancelled = true
      }
    }

    cli.default
      .handleApiCheckpoint({
        checkpointId: selectedCheckpoint.id,
      })
      .then((response) => {
        if (cancelled) {
          return
        }

        setCheckpointDetail(response)
        setCheckpointDetailSource('api')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error(
          `Failed to load checkpoint details for ${selectedCheckpoint.id}`,
          error,
        )
        setCheckpointDetail(null)
        setCheckpointDetailSource('error')
      })

    return () => {
      cancelled = true
    }
  }, [cli, selectedCheckpoint, checkpointDetailSource])

  const onFromDateSelect = (date: Date | undefined) => {
    setFromDate(date)

    if (date && toDate && date > toDate) {
      setToDate(date)
    }
  }

  const onToDateSelect = (date: Date | undefined) => {
    setToDate(date)

    if (date && fromDate && date < fromDate) {
      setFromDate(date)
    }
  }

  const clearFilters = () => {
    setSelectedBranch(null)
    setSelectedUser(null)
    setSelectedAgent(null)
    setFromDate(undefined)
    setToDate(undefined)
  }

  const onCheckpointSelect = (checkpoint: Checkpoint) => {
    setSelectedCheckpoint(checkpoint)
    setCheckpointDetail(null)
    setCheckpointDetailSource('loading')
  }

  const visibleRows = effectiveBranch ? rows : []
  const visibleUserOptions = effectiveBranch ? userOptions : []
  const visibleAgentOptions = effectiveBranch ? agentOptions : []
  const visibleSelectedUser = effectiveBranch ? selectedUser : null
  const visibleSelectedAgent = effectiveBranch ? selectedAgent : null
  const visibleDataSource: LoadState =
    dataSource === 'error' ? 'error' : effectiveBranch ? dataSource : 'api'

  return {
    rows: visibleRows,
    branchOptions,
    userOptions: visibleUserOptions,
    agentOptions: visibleAgentOptions,
    selectedBranch,
    selectedUser: visibleSelectedUser,
    selectedAgent: visibleSelectedAgent,
    fromDate,
    toDate,
    effectiveBranch,
    dataSource: visibleDataSource,
    optionsSource,
    selectedCheckpoint,
    checkpointDetail,
    checkpointDetailSource,
    onBranchChange: setSelectedBranch,
    onUserChange: setSelectedUser,
    onAgentChange: setSelectedAgent,
    onFromDateChange: onFromDateSelect,
    onToDateChange: onToDateSelect,
    onClearFilters: clearFilters,
    onCheckpointSelect,
  }
}
