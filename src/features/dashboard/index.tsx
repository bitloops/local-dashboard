import { useEffect, useMemo, useState } from 'react'
import {
  BitloopsCli,
  type ApiAgentDto,
  type ApiBranchSummaryDto,
  type ApiCheckpointDetailResponse,
  type ApiCommitRowDto,
  type ApiUserDto,
} from '@/api/types/schema'
import {
  DashboardView,
  type CheckpointDetailLoadState,
  type UserOption,
} from './dashboard-view'
import { type Checkpoint, type CommitData } from './data/mock-commit-data'

export const startOfDayIso = (date: Date): string => {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized.toISOString()
}

export const endOfDayIso = (date: Date): string => {
  const normalized = new Date(date)
  normalized.setHours(23, 59, 59, 999)
  return normalized.toISOString()
}

export const formatCommitDate = (timestamp: number): { label: string; ms: number } => {
  const ts = timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000
  const date = new Date(ts)

  if (Number.isNaN(date.getTime())) {
    return { label: '-', ms: 0 }
  }

  return {
    label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    ms: date.getTime(),
  }
}

export const formatCheckpointTime = (value: string): string => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const mapUserOptions = (users: ApiUserDto[]): UserOption[] => {
  const uniqueUsers = new Map<string, UserOption>()

  for (const user of users) {
    const value = user.key.trim()
    if (!value) {
      continue
    }

    const label = user.name
      ? user.email
        ? `${user.name} (${user.email})`
        : user.name
      : user.email || value

    uniqueUsers.set(value, { label, value })
  }

  return Array.from(uniqueUsers.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  )
}

export const mapAgentOptions = (agents: ApiAgentDto[]): string[] =>
  Array.from(
    new Set(
      agents
        .map((agent) => agent.key.trim())
        .filter((agent): agent is string => agent.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b))

export const mapCommitRows = (rows: ApiCommitRowDto[]): CommitData[] => {
  const commits = new Map<string, CommitData & { timestamp: number }>()

  for (const row of rows) {
    const sha = row.commit.sha
    const commitDate = formatCommitDate(row.commit.timestamp)

    const checkpoint = {
      id: row.checkpoint.checkpoint_id,
      prompt:
        row.checkpoint.tool_use_id ||
        row.checkpoint.checkpoint_id,
      timestamp: formatCheckpointTime(row.checkpoint.created_at),
      createdAt: row.checkpoint.created_at,
      branch: row.checkpoint.branch,
      agent: row.checkpoint.agent,
      strategy: row.checkpoint.strategy,
      sessionId: row.checkpoint.session_id,
      toolUseId: row.checkpoint.tool_use_id,
      filesTouched: row.checkpoint.files_touched,
      sessionCount: row.checkpoint.session_count,
      checkpointsCount: row.checkpoint.checkpoints_count,
      isTask: row.checkpoint.is_task,
      commit: row.commit.sha.slice(0, 7),
      commitMessage: row.commit.message,
    }

    const existing = commits.get(sha)
    if (existing) {
      existing.checkpointList.push(checkpoint)
      existing.checkpoints = existing.checkpointList.length
      continue
    }

    commits.set(sha, {
      date: commitDate.label,
      commit: sha.slice(0, 7),
      checkpoints: 1,
      message: row.commit.message,
      agent: row.checkpoint.agent,
      checkpointList: [checkpoint],
      timestamp: commitDate.ms,
    })
  }

  return Array.from(commits.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((commit) => ({
      date: commit.date,
      commit: commit.commit,
      checkpoints: commit.checkpoints,
      message: commit.message,
      agent: commit.agent,
      checkpointList: commit.checkpointList,
    }))
}

export function Dashboard() {
  const cli = useMemo(
    () =>
      new BitloopsCli({
        BASE: import.meta.env.VITE_BITLOOPS_CLI_BASE ?? 'http://127.0.0.1:5667',
      }),
    []
  )

  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined)
  const [toDate, setToDate] = useState<Date | undefined>(undefined)

  const [branchOptions, setBranchOptions] = useState<string[]>([])
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [agentOptions, setAgentOptions] = useState<string[]>([])
  const [rows, setRows] = useState<CommitData[]>([])
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(
    null
  )
  const [checkpointDetail, setCheckpointDetail] =
    useState<ApiCheckpointDetailResponse | null>(null)
  const [checkpointDetailSource, setCheckpointDetailSource] =
    useState<CheckpointDetailLoadState>('idle')
  const [dataSource, setDataSource] = useState<'loading' | 'api' | 'error'>(
    'loading'
  )
  const [optionsSource, setOptionsSource] = useState<
    'loading' | 'api' | 'error'
  >('loading')

  const from = fromDate ? startOfDayIso(fromDate) : null
  const to = toDate ? endOfDayIso(toDate) : null
  const effectiveBranch = selectedBranch ?? branchOptions[0] ?? null

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
        if (cancelled) {
          return
        }

        console.error('Failed to load branches — falling back to mock data', error)
        setBranchOptions(['main'])
        setSelectedBranch(null)
        setOptionsSource('api')
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

        setRows(mapCommitRows(commitRows))
        setDataSource('api')
        setOptionsSource('api')
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        console.error('Failed to load dashboard data', error)
        setRows([])
        setUserOptions([])
        setAgentOptions([])
        setDataSource('error')
        setOptionsSource('error')
      })

    return () => {
      cancelled = true
    }
  }, [cli, effectiveBranch, from, to, selectedAgent, selectedUser])

  useEffect(() => {
    let cancelled = false

    if (!selectedCheckpoint) {
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
        if (cancelled) {
          return
        }

        console.error(
          `Failed to load checkpoint details for ${selectedCheckpoint.id}`,
          error
        )

        setCheckpointDetail(null)
        setCheckpointDetailSource('error')
      })

    return () => {
      cancelled = true
    }
  }, [cli, selectedCheckpoint])

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

  const onCheckpointClose = () => {
    setSelectedCheckpoint(null)
    setCheckpointDetail(null)
    setCheckpointDetailSource('idle')
  }

  const visibleRows = effectiveBranch ? rows : []
  const visibleUserOptions = effectiveBranch ? userOptions : []
  const visibleAgentOptions = effectiveBranch ? agentOptions : []
  const visibleSelectedUser = effectiveBranch ? selectedUser : null
  const visibleSelectedAgent = effectiveBranch ? selectedAgent : null
  const visibleDataSource = effectiveBranch ? dataSource : 'api'

  return (
    <DashboardView
      rows={visibleRows}
      branchOptions={branchOptions}
      userOptions={visibleUserOptions}
      agentOptions={visibleAgentOptions}
      selectedBranch={selectedBranch}
      selectedUser={visibleSelectedUser}
      selectedAgent={visibleSelectedAgent}
      fromDate={fromDate}
      toDate={toDate}
      effectiveBranch={effectiveBranch}
      dataSource={visibleDataSource}
      optionsSource={optionsSource}
      selectedCheckpoint={selectedCheckpoint}
      checkpointDetail={checkpointDetail}
      checkpointDetailSource={checkpointDetailSource}
      onBranchChange={setSelectedBranch}
      onUserChange={setSelectedUser}
      onAgentChange={setSelectedAgent}
      onFromDateChange={onFromDateSelect}
      onToDateChange={onToDateSelect}
      onClearFilters={clearFilters}
      onCheckpointSelect={onCheckpointSelect}
      onCheckpointClose={onCheckpointClose}
    />
  )
}
