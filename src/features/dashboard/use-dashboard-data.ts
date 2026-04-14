import { useCallback, useEffect, useRef, useState } from 'react'
import { rootStoreInstance, useStore } from '@/store'
import { useShallow } from 'zustand/react/shallow'
import { syncQueryExplorerVariablesWithDashboardSelection } from '@/store/slices/query-explorer'
import { type Checkpoint, type LoadState } from './types'
import {
  COMMITS_PAGE_SIZE,
  fetchDashboardAgents,
  fetchDashboardBranches,
  fetchDashboardCheckpointDetail,
  fetchDashboardCommitsPage,
  fetchDashboardRepositories,
  fetchDashboardUsers,
} from './graphql/fetch-dashboard-data'
import type { DashboardCommitsRequest } from '@/store/slices/dashboard'
import {
  endOfDayUnixSeconds,
  mapAgentOptions,
  mapCommitRows,
  mapUserOptions,
  startOfDayUnixSeconds,
} from './utils'

export function useDashboardData() {
  const {
    selectedRepoId,
    selectedBranch,
    selectedUser,
    selectedAgent,
    fromDate,
    toDate,
    repoOptions,
    branchOptions,
    userOptions,
    agentOptions,
    rows,
    commitsPageInfo,
    selectedCheckpointId,
    checkpointDetail,
    checkpointDetailSource,
    setSelectedRepoId,
    setSelectedBranch,
    setSelectedUser,
    setSelectedAgent,
    setFromDate,
    setToDate,
    setRepoOptions,
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
      selectedRepoId: state.selectedRepoId,
      selectedBranch: state.selectedBranch,
      selectedUser: state.selectedUser,
      selectedAgent: state.selectedAgent,
      fromDate: state.fromDate,
      toDate: state.toDate,
      repoOptions: state.repoOptions,
      branchOptions: state.branchOptions,
      userOptions: state.userOptions,
      agentOptions: state.agentOptions,
      rows: state.rows,
      commitsPageInfo: state.commitsPageInfo,
      selectedCheckpointId: state.selectedCheckpointId,
      checkpointDetail: state.checkpointDetail,
      checkpointDetailSource: state.checkpointDetailSource,
      setSelectedRepoId: state.setSelectedRepoId,
      setSelectedBranch: state.setSelectedBranch,
      setSelectedUser: state.setSelectedUser,
      setSelectedAgent: state.setSelectedAgent,
      setFromDate: state.setFromDate,
      setToDate: state.setToDate,
      setRepoOptions: state.setRepoOptions,
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
  const [branchOptionsRequestState, setBranchOptionsRequestState] = useState<{
    key: string | null
    source: Exclude<LoadState, 'loading'>
  }>({
    key: null,
    source: 'api',
  })

  const commitsAbortRef = useRef<AbortController | null>(null)

  const effectiveRepoOption =
    repoOptions.find((repo) => repo.repoId === selectedRepoId) ??
    repoOptions[0] ??
    null
  const effectiveRepoId = effectiveRepoOption?.repoId ?? null
  const effectiveRepoIdentity = effectiveRepoOption?.identity ?? null
  const defaultBranchFallback =
    effectiveRepoOption?.defaultBranch?.trim() || null
  const from = fromDate != null ? String(startOfDayUnixSeconds(fromDate)) : null
  const to = toDate != null ? String(endOfDayUnixSeconds(toDate)) : null
  const branchOptionsRequestKey =
    effectiveRepoId === null
      ? null
      : `${effectiveRepoId}:${from ?? ''}:${to ?? ''}`
  const visibleBranchOptionsSource: LoadState =
    branchOptionsRequestKey === null ||
    branchOptionsRequestState.key !== branchOptionsRequestKey
      ? 'loading'
      : branchOptionsRequestState.source
  // The central daemon catalogue may know the default branch before branch enumeration is wired.
  const effectiveBranch =
    selectedBranch ?? branchOptions[0] ?? defaultBranchFallback
  const selectedCheckpoint =
    rows
      .flatMap((row) => row.checkpointList)
      .find((cp) => cp.id === selectedCheckpointId) ?? null

  useEffect(() => {
    const { variables, setVariables } = rootStoreInstance.getState()
    const syncResult = syncQueryExplorerVariablesWithDashboardSelection(
      variables,
      effectiveRepoIdentity,
      effectiveBranch,
    )

    if (syncResult.updated && syncResult.variables !== variables) {
      setVariables(syncResult.variables)
    }
  }, [effectiveRepoIdentity, effectiveBranch])

  useEffect(() => {
    selectedCheckpointRef.current = selectedCheckpoint
  }, [selectedCheckpoint])

  useEffect(() => {
    let cancelled = false

    fetchDashboardRepositories()
      .then((repositories) => {
        if (cancelled) {
          return
        }

        setRepoOptions(repositories)
        if (
          selectedRepoId &&
          !repositories.some((repo) => repo.repoId === selectedRepoId)
        ) {
          setSelectedRepoId(null)
        }
        setOptionsSource('api')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Failed to load repositories', error)
        setRepoOptions([])
        setOptionsSource('error')
      })

    return () => {
      cancelled = true
    }
  }, [selectedRepoId, setRepoOptions, setSelectedRepoId])

  useEffect(() => {
    if (!effectiveRepoId) {
      return
    }

    let cancelled = false

    fetchDashboardBranches({
      repoId: effectiveRepoId,
      from,
      to,
    })
      .then((branches) => {
        if (cancelled) {
          return
        }

        const nextBranches = branches
          .map((branch) => branch.branch.trim())
          .filter((branch): branch is string => branch.length > 0)

        setBranchOptions(nextBranches)
        if (selectedBranch && !nextBranches.includes(selectedBranch)) {
          setSelectedBranch(null)
        }
        setBranchOptionsRequestState({
          key: branchOptionsRequestKey,
          source: 'api',
        })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Failed to load branches', error)
        setBranchOptionsRequestState({
          key: branchOptionsRequestKey,
          source: 'error',
        })
      })

    return () => {
      cancelled = true
    }
  }, [
    branchOptionsRequestKey,
    effectiveRepoId,
    from,
    selectedBranch,
    setBranchOptions,
    setSelectedBranch,
    to,
  ])

  useEffect(() => {
    if (!effectiveRepoId || !effectiveBranch) {
      setUserOptions([])
      setAgentOptions([])
      return
    }

    let cancelled = false

    Promise.all([
      fetchDashboardUsers({
        repoId: effectiveRepoId,
        branch: effectiveBranch,
        from,
        to,
        agent: selectedAgent,
      }),
      fetchDashboardAgents({
        repoId: effectiveRepoId,
        branch: effectiveBranch,
        from,
        to,
        user: selectedUser,
      }),
    ])
      .then(([users, agents]) => {
        if (cancelled) {
          return
        }

        const nextUserOptions = mapUserOptions(users)
        const nextAgentOptions = mapAgentOptions(agents)

        setUserOptions(nextUserOptions)
        if (
          selectedUser &&
          !nextUserOptions.some((option) => option.value === selectedUser)
        ) {
          setSelectedUser(null)
          setCurrentCommitsRequest({ offset: 0 })
        }

        setAgentOptions(nextAgentOptions)
        if (selectedAgent && !nextAgentOptions.includes(selectedAgent)) {
          setSelectedAgent(null)
          setCurrentCommitsRequest({ offset: 0 })
        }

        setOptionsSource('api')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Failed to load users or agents', error)
        setOptionsSource('error')
      })

    return () => {
      cancelled = true
    }
  }, [
    effectiveBranch,
    effectiveRepoId,
    from,
    selectedAgent,
    selectedUser,
    setAgentOptions,
    setCurrentCommitsRequest,
    setSelectedAgent,
    setSelectedUser,
    setUserOptions,
    to,
  ])

  const loadCommitsPage = useCallback(
    async (paginationArg?: DashboardCommitsRequest) => {
      if (!effectiveRepoId || !effectiveBranch) {
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
          {
            repoId: effectiveRepoId,
            branch: effectiveBranch,
            from,
            to,
            user: selectedUser,
            agent: selectedAgent,
            offset: pagination.offset,
          },
          { signal: ac.signal },
        )

        if (ac.signal.aborted) {
          return
        }

        const mappedRows = mapCommitRows(data.rows)
        setRows(mappedRows)
        setCurrentCommitsRequest(pagination)
        setCommitsPageInfo({
          hasNextPage: data.hasNextPage,
          hasPreviousPage: pagination.offset > 0,
          offset: pagination.offset,
        })

        const allCheckpoints = mappedRows.flatMap((row) => row.checkpointList)
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
      effectiveRepoId,
      from,
      selectedAgent,
      selectedUser,
      setCheckpointDetail,
      setCheckpointDetailSource,
      setCommitsPageInfo,
      setCurrentCommitsRequest,
      setRows,
      setSelectedCheckpointId,
      to,
    ],
  )

  useEffect(() => {
    if (!effectiveRepoId || !effectiveBranch) {
      setRows([])
      setCommitsPageInfo(null)
      setCurrentCommitsRequest({ offset: 0 })
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
    effectiveRepoId,
    from,
    loadCommitsPage,
    selectedAgent,
    selectedUser,
    setCommitsPageInfo,
    setCurrentCommitsRequest,
    setRows,
    setSelectedCheckpointId,
    to,
  ])

  const visibleCommitsPageInfo = effectiveBranch ? commitsPageInfo : null
  const commitsHasNextPage = visibleCommitsPageInfo?.hasNextPage === true
  const commitsHasPreviousPage =
    visibleCommitsPageInfo?.hasPreviousPage === true

  const onCommitsNext = useCallback(() => {
    const offset = visibleCommitsPageInfo?.offset ?? 0
    if (!commitsHasNextPage) {
      return
    }
    void loadCommitsPage({ offset: offset + COMMITS_PAGE_SIZE })
  }, [commitsHasNextPage, loadCommitsPage, visibleCommitsPageInfo?.offset])

  const onCommitsBack = useCallback(() => {
    const offset = visibleCommitsPageInfo?.offset ?? 0
    if (!commitsHasPreviousPage) {
      return
    }
    void loadCommitsPage({ offset: Math.max(0, offset - COMMITS_PAGE_SIZE) })
  }, [commitsHasPreviousPage, loadCommitsPage, visibleCommitsPageInfo?.offset])

  useEffect(() => {
    let cancelled = false

    if (!selectedCheckpoint || checkpointDetailSource !== 'loading') {
      return () => {
        cancelled = true
      }
    }
    if (!effectiveRepoId) {
      setCheckpointDetail(null)
      setCheckpointDetailSource('error')
      return () => {
        cancelled = true
      }
    }

    fetchDashboardCheckpointDetail({
      repoId: effectiveRepoId,
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
  }, [
    checkpointDetailSource,
    effectiveRepoId,
    selectedCheckpoint,
    setCheckpointDetail,
    setCheckpointDetailSource,
  ])

  const onFromDateSelect = (date: Date | undefined) => {
    setFromDate(date)
    setCurrentCommitsRequest({ offset: 0 })

    if (date && toDate && date > toDate) {
      setToDate(date)
    }
  }

  const onToDateSelect = (date: Date | undefined) => {
    setToDate(date)
    setCurrentCommitsRequest({ offset: 0 })

    if (date && fromDate && date < fromDate) {
      setFromDate(date)
    }
  }

  const clearFilters = () => {
    resetDashboardFilters()
    if (selectedRepoId) {
      setBranchOptions([])
      setUserOptions([])
      setAgentOptions([])
      setRows([])
      setCommitsPageInfo(null)
      setSelectedCheckpointId(null)
      setCheckpointDetail(null)
      setCheckpointDetailSource('idle')
    }
  }

  const onRepoChange = (value: string | null) => {
    setSelectedRepoId(value)
    setSelectedBranch(null)
    setSelectedUser(null)
    setSelectedAgent(null)
    setBranchOptions([])
    setUserOptions([])
    setAgentOptions([])
    setRows([])
    setCommitsPageInfo(null)
    setSelectedCheckpointId(null)
    setCheckpointDetail(null)
    setCheckpointDetailSource('idle')
    setCurrentCommitsRequest({ offset: 0 })
  }

  const onBranchChange = (value: string | null) => {
    setSelectedBranch(value)
    setCurrentCommitsRequest({ offset: 0 })
  }

  const onUserChange = (value: string | null) => {
    setSelectedUser(value)
    setCurrentCommitsRequest({ offset: 0 })
  }

  const onAgentChange = (value: string | null) => {
    setSelectedAgent(value)
    setCurrentCommitsRequest({ offset: 0 })
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
    repoOptions,
    branchOptions,
    userOptions: visibleUserOptions,
    agentOptions: visibleAgentOptions,
    selectedRepoId,
    selectedBranch,
    selectedUser: visibleSelectedUser,
    selectedAgent: visibleSelectedAgent,
    effectiveRepoIdentity,
    fromDate,
    toDate,
    effectiveBranch,
    dataSource: visibleDataSource,
    optionsSource,
    branchOptionsSource: visibleBranchOptionsSource,
    commitsHasNextPage: visibleCommitsPageInfo?.hasNextPage === true,
    commitsHasPreviousPage: effectiveBranch ? commitsHasPreviousPage : false,
    onCommitsNext,
    onCommitsBack,
    selectedCheckpoint,
    checkpointDetail,
    checkpointDetailSource,
    onRepoChange,
    onBranchChange,
    onUserChange,
    onAgentChange,
    onFromDateChange: onFromDateSelect,
    onToDateChange: onToDateSelect,
    onClearFilters: clearFilters,
    onCheckpointSelect,
  }
}
