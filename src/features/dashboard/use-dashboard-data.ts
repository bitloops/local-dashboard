import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BitloopsCli, type ApiCheckpointDetailResponse } from '@/api/rest'
import { requestGraphQL } from '@/api/graphql/client'
import {
  type Checkpoint,
  type CheckpointDetailLoadState,
  type CommitData,
  type LoadState,
  type UserOption,
} from './types'
import {
  DASHBOARD_BRANCHES_QUERY,
  DASHBOARD_REPO_NAME,
} from './graphql/operations'
import {
  fetchDashboardCommitsPage,
  fetchDashboardRepoOptions,
} from './graphql/fetch-dashboard-data'
import {
  mapDashboardBranches,
  mapDashboardCommitRows,
  mapRepoAgentStrings,
  mapRepoUserStrings,
} from './graphql/mappers'
import type { DashboardBranchesQueryData } from './graphql/types'
import { rootStoreInstance, useStore } from '@/store'
import {
  endOfDayIso,
  mapAgentOptions,
  mapCommitRows,
  mapUserOptions,
  startOfDayIso,
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
  const [commitsPageInfo, setCommitsPageInfo] = useState<{
    hasNextPage: boolean
    endCursor: string | null
  } | null>(null)
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

  const commitsAbortRef = useRef<AbortController | null>(null)

  const effectiveBranch = selectedBranch ?? branchOptions[0] ?? null
  const since = fromDate != null ? startOfDayIso(fromDate) : null
  const until = toDate != null ? endOfDayIso(toDate) : null

  useEffect(() => {
    selectedCheckpointRef.current = selectedCheckpoint
  }, [selectedCheckpoint])

  useEffect(() => {
    let cancelled = false

    Promise.all([
      requestGraphQL<DashboardBranchesQueryData>(DASHBOARD_BRANCHES_QUERY, {
        repo: DASHBOARD_REPO_NAME,
        since,
        until,
      }),
      fetchDashboardRepoOptions({
        repo: DASHBOARD_REPO_NAME,
      }),
    ])
      .then(([branchResponse, repoOptions]) => {
        if (cancelled) {
          return
        }

        if (branchResponse.errors?.length) {
          throw new Error(branchResponse.errors[0].message)
        }

        const branches = mapDashboardBranches({
          repo: branchResponse.data?.repo ?? null,
        })
        const nextBranches = branches
          .map((branch) => branch.branch.trim())
          .filter((branch): branch is string => branch.length > 0)

        const users = mapRepoUserStrings(repoOptions.repo?.users ?? [])
        const agents = mapRepoAgentStrings(repoOptions.repo?.agents ?? [])
        const nextUserOptions = mapUserOptions(users)
        const nextAgentOptions = mapAgentOptions(agents)

        setBranchOptions(nextBranches)
        setSelectedBranch((current) => {
          if (!current) {
            return null
          }

          return nextBranches.includes(current) ? current : null
        })

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

        setOptionsSource('api')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Failed to load branches or repo options', error)
        setOptionsSource('error')
      })

    return () => {
      cancelled = true
    }
  }, [since, until])

  const loadCommits = useCallback(async () => {
    if (!effectiveBranch) {
      return
    }

    commitsAbortRef.current?.abort()
    const ac = new AbortController()
    commitsAbortRef.current = ac

    const after =
      rootStoreInstance.getState().dashboardCommitsAfterStack.at(-1) ?? null

    setDataSource('loading')

    try {
      const data = await fetchDashboardCommitsPage(
        {
          repo: DASHBOARD_REPO_NAME,
          branch: effectiveBranch,
          since,
          until,
          author: selectedUser,
          after,
        },
        { signal: ac.signal },
      )

      if (ac.signal.aborted) {
        return
      }

      const commitRows = mapDashboardCommitRows(data, {
        user: selectedUser,
        agent: selectedAgent,
        userFilterFromServer: selectedUser != null,
      })

      const mappedRows = mapCommitRows(commitRows)
      setRows(mappedRows)

      const pi = data.repo?.commits.pageInfo
      setCommitsPageInfo(
        pi
          ? {
              hasNextPage: pi.hasNextPage === true,
              endCursor: pi.endCursor ?? null,
            }
          : null,
      )

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
    } catch (error: unknown) {
      if (
        (error instanceof DOMException || error instanceof Error) &&
        error.name === 'AbortError'
      ) {
        return
      }
      console.error('Failed to load dashboard commits', error)
      setDataSource('error')
      setCommitsPageInfo(null)
    }
  }, [effectiveBranch, since, until, selectedUser, selectedAgent])

  useEffect(() => {
    if (!effectiveBranch) {
      rootStoreInstance.getState().resetDashboardCommitsPagination()
      return () => {
        commitsAbortRef.current?.abort()
      }
    }

    rootStoreInstance.getState().resetDashboardCommitsPagination()
    const loadTimer = window.setTimeout(() => {
      void loadCommits()
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
      commitsAbortRef.current?.abort()
    }
  }, [effectiveBranch, since, until, selectedUser, selectedAgent, loadCommits])

  const stackDepth = useStore((s) => s.dashboardCommitsAfterStack.length)

  const commitsHasNextPage = commitsPageInfo?.hasNextPage === true
  const commitsHasPreviousPage = stackDepth > 1

  const onCommitsNext = useCallback(() => {
    const end = commitsPageInfo?.endCursor
    if (!commitsHasNextPage || !end) {
      return
    }
    rootStoreInstance.getState().pushDashboardCommitsCursor(end)
    void loadCommits()
  }, [commitsHasNextPage, commitsPageInfo?.endCursor, loadCommits])

  const onCommitsBack = useCallback(() => {
    if (!commitsHasPreviousPage) {
      return
    }
    rootStoreInstance.getState().popDashboardCommitsCursor()
    void loadCommits()
  }, [commitsHasPreviousPage, loadCommits])

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
  const visibleCommitsPageInfo = effectiveBranch ? commitsPageInfo : null
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
    commitsHasNextPage: visibleCommitsPageInfo?.hasNextPage === true,
    commitsHasPreviousPage: effectiveBranch ? commitsHasPreviousPage : false,
    onCommitsNext,
    onCommitsBack,
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
