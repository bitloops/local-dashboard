import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BitloopsCli } from '@/api/rest'
import { requestGraphQL } from '@/api/graphql/client'
import { rootStoreInstance, useStore } from '@/store'
import { useShallow } from 'zustand/react/shallow'
import { type Checkpoint, type LoadState } from './types'
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
import type { DashboardCommitsRequest } from '@/store/slices/dashboard'
import {
  endOfDayIso,
  mapAgentOptions,
  mapCommitRows,
  mapUserOptions,
  startOfDayIso,
} from './utils'

export function useDashboardData() {
  const cli = useMemo(() => new BitloopsCli(), [])
  const {
    selectedBranch,
    selectedUser,
    selectedAgent,
    fromDate,
    toDate,
    branchOptions,
    userOptions,
    agentOptions,
    rows,
    commitsPageInfo,
    selectedCheckpointId,
    checkpointDetail,
    checkpointDetailSource,
    setSelectedBranch,
    setSelectedUser,
    setSelectedAgent,
    setFromDate,
    setToDate,
    setBranchOptions,
    setUserOptions,
    setAgentOptions,
    setRows,
    setCommitsPageInfo,
    setCurrentCommitsRequest,
    setSelectedCheckpointId,
    setCheckpointDetail,
    setCheckpointDetailSource,
    resetDashboardFilters,
  } = useStore(
    useShallow((state) => ({
      selectedBranch: state.selectedBranch,
      selectedUser: state.selectedUser,
      selectedAgent: state.selectedAgent,
      fromDate: state.fromDate,
      toDate: state.toDate,
      branchOptions: state.branchOptions,
      userOptions: state.userOptions,
      agentOptions: state.agentOptions,
      rows: state.rows,
      commitsPageInfo: state.commitsPageInfo,
      selectedCheckpointId: state.selectedCheckpointId,
      checkpointDetail: state.checkpointDetail,
      checkpointDetailSource: state.checkpointDetailSource,
      setSelectedBranch: state.setSelectedBranch,
      setSelectedUser: state.setSelectedUser,
      setSelectedAgent: state.setSelectedAgent,
      setFromDate: state.setFromDate,
      setToDate: state.setToDate,
      setBranchOptions: state.setBranchOptions,
      setUserOptions: state.setUserOptions,
      setAgentOptions: state.setAgentOptions,
      setRows: state.setRows,
      setCommitsPageInfo: state.setCommitsPageInfo,
      setCurrentCommitsRequest: state.setCurrentCommitsRequest,
      setSelectedCheckpointId: state.setSelectedCheckpointId,
      setCheckpointDetail: state.setCheckpointDetail,
      setCheckpointDetailSource: state.setCheckpointDetailSource,
      resetDashboardFilters: state.resetDashboardFilters,
    })),
  )
  const selectedCheckpointRef = useRef<Checkpoint | null>(null)
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
  const selectedCheckpoint =
    rows
      .flatMap((row) => row.checkpointList)
      .find((cp) => cp.id === selectedCheckpointId) ?? null

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
        if (selectedBranch && !nextBranches.includes(selectedBranch)) {
          setSelectedBranch(null)
        }

        setUserOptions(nextUserOptions)
        if (
          selectedUser &&
          !nextUserOptions.some((option) => option.value === selectedUser)
        ) {
          setSelectedUser(null)
          setCurrentCommitsRequest({ after: null })
        }

        setAgentOptions(nextAgentOptions)
        if (selectedAgent && !nextAgentOptions.includes(selectedAgent)) {
          setSelectedAgent(null)
          setCurrentCommitsRequest({ after: null })
        }

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

  const loadCommitsPage = useCallback(
    async (paginationArg?: DashboardCommitsRequest) => {
      if (!effectiveBranch) {
        return
      }
      const pagination =
        paginationArg ?? rootStoreInstance.getState().currentCommitsRequest

      commitsAbortRef.current?.abort()
      const ac = new AbortController()
      commitsAbortRef.current = ac

      setDataSource('loading')

      try {
        const data = await fetchDashboardCommitsPage(
          pagination.direction === 'backward'
            ? {
                direction: 'backward',
                repo: DASHBOARD_REPO_NAME,
                branch: effectiveBranch,
                since,
                until,
                author: selectedUser,
                before: pagination.before,
              }
            : {
                repo: DASHBOARD_REPO_NAME,
                branch: effectiveBranch,
                since,
                until,
                author: selectedUser,
                after: pagination.after,
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
        setCurrentCommitsRequest(pagination)

        const pi = data.repo?.commits.pageInfo
        setCommitsPageInfo(
          pi
            ? {
                hasNextPage: pi.hasNextPage === true,
                hasPreviousPage: pi.hasPreviousPage === true,
                startCursor: pi.startCursor ?? null,
                endCursor: pi.endCursor ?? null,
              }
            : null,
        )

        const allCheckpoints = mappedRows.flatMap((r) => r.checkpointList)
        const firstCheckpoint = allCheckpoints[0] ?? null

        const prev = selectedCheckpointRef.current
        const next =
          prev && allCheckpoints.some((cp) => cp.id === prev.id)
            ? prev
            : firstCheckpoint
        setSelectedCheckpointId(next?.id ?? null)
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
    },
    [
      effectiveBranch,
      selectedAgent,
      selectedUser,
      setCheckpointDetail,
      setCheckpointDetailSource,
      setCommitsPageInfo,
      setCurrentCommitsRequest,
      setRows,
      setSelectedCheckpointId,
      since,
      until,
    ],
  )

  useEffect(() => {
    if (!effectiveBranch) {
      setRows([])
      setCommitsPageInfo(null)
      setCurrentCommitsRequest({ after: null })
      setSelectedCheckpointId(null)
      return () => {
        commitsAbortRef.current?.abort()
      }
    }

    setCommitsPageInfo(null)
    const loadTimer = window.setTimeout(() => {
      void loadCommitsPage()
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
      commitsAbortRef.current?.abort()
    }
  }, [
    effectiveBranch,
    since,
    until,
    selectedUser,
    selectedAgent,
    loadCommitsPage,
    setCommitsPageInfo,
    setCurrentCommitsRequest,
    setRows,
    setSelectedCheckpointId,
  ])

  const visibleCommitsPageInfo = effectiveBranch ? commitsPageInfo : null
  const commitsHasNextPage = visibleCommitsPageInfo?.hasNextPage === true
  const commitsHasPreviousPage =
    visibleCommitsPageInfo?.hasPreviousPage === true

  const onCommitsNext = useCallback(() => {
    const end = visibleCommitsPageInfo?.endCursor
    if (!commitsHasNextPage || !end) {
      return
    }
    void loadCommitsPage({ after: end })
  }, [commitsHasNextPage, visibleCommitsPageInfo?.endCursor, loadCommitsPage])

  const onCommitsBack = useCallback(() => {
    const start = visibleCommitsPageInfo?.startCursor
    if (!commitsHasPreviousPage || !start) {
      return
    }
    void loadCommitsPage({ direction: 'backward', before: start })
  }, [
    commitsHasPreviousPage,
    visibleCommitsPageInfo?.startCursor,
    loadCommitsPage,
  ])

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
    setCurrentCommitsRequest({ after: null })

    if (date && toDate && date > toDate) {
      setToDate(date)
    }
  }

  const onToDateSelect = (date: Date | undefined) => {
    setToDate(date)
    setCurrentCommitsRequest({ after: null })

    if (date && fromDate && date < fromDate) {
      setFromDate(date)
    }
  }

  const clearFilters = () => {
    resetDashboardFilters()
  }

  const onBranchChange = (value: string | null) => {
    setSelectedBranch(value)
    setCurrentCommitsRequest({ after: null })
  }

  const onUserChange = (value: string | null) => {
    setSelectedUser(value)
    setCurrentCommitsRequest({ after: null })
  }

  const onAgentChange = (value: string | null) => {
    setSelectedAgent(value)
    setCurrentCommitsRequest({ after: null })
  }

  const onCheckpointSelect = (checkpoint: Checkpoint) => {
    setSelectedCheckpointId(checkpoint.id)
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
    commitsHasNextPage: visibleCommitsPageInfo?.hasNextPage === true,
    commitsHasPreviousPage: effectiveBranch ? commitsHasPreviousPage : false,
    onCommitsNext,
    onCommitsBack,
    selectedCheckpoint,
    checkpointDetail,
    checkpointDetailSource,
    onBranchChange,
    onUserChange,
    onAgentChange,
    onFromDateChange: onFromDateSelect,
    onToDateChange: onToDateSelect,
    onClearFilters: clearFilters,
    onCheckpointSelect,
  }
}
