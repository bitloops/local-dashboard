import { useCallback, useEffect, useRef, useState } from 'react'
import { rootStoreInstance, useStore } from '@/store'
import { useShallow } from 'zustand/react/shallow'
import { syncQueryExplorerVariablesWithDashboardSelection } from '@/store/slices/query-explorer'
import type { DashboardInteractionSessionDto } from './api-types'
import { type Checkpoint, type LoadState } from './types'
import {
  DASHBOARD_PAGE_SIZE,
  fetchDashboardAgents,
  fetchDashboardBranches,
  fetchDashboardCheckpointDetail,
  fetchDashboardCommitsPage,
  fetchDashboardInteractionSessionsPage,
  fetchDashboardRepositories,
  fetchDashboardUsers,
} from './graphql/fetch-dashboard-data'
import type { DashboardSessionsRequest } from '@/store/slices/dashboard'
import {
  endOfDayIso,
  endOfDayUnixSeconds,
  mapAgentOptions,
  mapCommitRows,
  mapUserOptions,
  startOfDayIso,
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
    sessionRows,
    sessionsPageInfo,
    selectedCheckpointId,
    selectedSessionId,
    selectedSessionSummary,
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
    setSessionRows,
    setSessionsPageInfo,
    setCurrentSessionsRequest,
    setSelectedSessionId,
    setSelectedSessionSummary,
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
      sessionRows: state.sessionRows,
      sessionsPageInfo: state.sessionsPageInfo,
      selectedCheckpointId: state.selectedCheckpointId,
      selectedSessionId: state.selectedSessionId,
      selectedSessionSummary: state.selectedSessionSummary,
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
      setSessionRows: state.setSessionRows,
      setSessionsPageInfo: state.setSessionsPageInfo,
      setCurrentSessionsRequest: state.setCurrentSessionsRequest,
      setSelectedSessionId: state.setSelectedSessionId,
      setSelectedSessionSummary: state.setSelectedSessionSummary,
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

  const dashboardAbortRef = useRef<AbortController | null>(null)

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
  const sinceRfc3339 = fromDate != null ? startOfDayIso(fromDate) : null
  const untilRfc3339 = toDate != null ? endOfDayIso(toDate) : null
  const branchOptionsRequestKey =
    effectiveRepoId === null
      ? null
      : `${effectiveRepoId}:${from ?? ''}:${to ?? ''}`
  const visibleBranchOptionsSource: LoadState =
    branchOptionsRequestKey === null ||
    branchOptionsRequestState.key !== branchOptionsRequestKey
      ? 'loading'
      : branchOptionsRequestState.source
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
          setCurrentSessionsRequest({ offset: 0 })
        }

        setAgentOptions(nextAgentOptions)
        if (selectedAgent && !nextAgentOptions.includes(selectedAgent)) {
          setSelectedAgent(null)
          setCurrentCommitsRequest({ offset: 0 })
          setCurrentSessionsRequest({ offset: 0 })
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
    setCurrentSessionsRequest,
    setSelectedAgent,
    setSelectedUser,
    setUserOptions,
    to,
  ])

  const loadChartCommitsOnly = useCallback(
    async (signal: AbortSignal) => {
      if (!effectiveRepoId || !effectiveBranch) {
        return
      }
      const commitsData = await fetchDashboardCommitsPage(
        {
          repoId: effectiveRepoId,
          branch: effectiveBranch,
          from,
          to,
          user: selectedUser,
          agent: selectedAgent,
          offset: 0,
        },
        { signal },
      )
      if (signal.aborted) {
        return
      }
      setRows(mapCommitRows(commitsData.rows))
      setCommitsPageInfo(null)
      setCurrentCommitsRequest({ offset: 0 })
    },
    [
      effectiveBranch,
      effectiveRepoId,
      from,
      selectedAgent,
      selectedUser,
      setCommitsPageInfo,
      setCurrentCommitsRequest,
      setRows,
      to,
    ],
  )

  const loadSessionsPageOnly = useCallback(
    async (
      sessionsReq: DashboardSessionsRequest,
      options?: { signal?: AbortSignal },
    ) => {
      if (!effectiveRepoId || !effectiveBranch) {
        return
      }
      const sessionsData = await fetchDashboardInteractionSessionsPage(
        {
          repoId: effectiveRepoId,
          branch: effectiveBranch,
          since: sinceRfc3339,
          until: untilRfc3339,
          agent: selectedAgent,
          commitAuthor: selectedUser,
          offset: sessionsReq.offset,
        },
        options,
      )
      if (options?.signal?.aborted) {
        return
      }
      setSessionRows(sessionsData.rows)
      setSessionsPageInfo({
        hasNextPage: sessionsData.hasNextPage,
        hasPreviousPage: sessionsReq.offset > 0,
        offset: sessionsReq.offset,
      })
      setCurrentSessionsRequest(sessionsReq)
    },
    [
      effectiveBranch,
      effectiveRepoId,
      selectedAgent,
      selectedUser,
      setCurrentSessionsRequest,
      setSessionRows,
      setSessionsPageInfo,
      sinceRfc3339,
      untilRfc3339,
    ],
  )

  const reloadDashboardForFilters = useCallback(async () => {
    if (!effectiveRepoId || !effectiveBranch) {
      return
    }

    dashboardAbortRef.current?.abort()
    const ac = new AbortController()
    dashboardAbortRef.current = ac

    setDataSource('loading')

    try {
      await Promise.all([
        loadSessionsPageOnly({ offset: 0 }, { signal: ac.signal }),
        loadChartCommitsOnly(ac.signal),
      ])
      if (ac.signal.aborted) {
        return
      }
      setDataSource('api')
    } catch (error: unknown) {
      if (
        (error instanceof DOMException || error instanceof Error) &&
        error.name === 'AbortError'
      ) {
        return
      }
      console.error('Failed to load dashboard sessions/commits', error)
      setDataSource('error')
      setSessionsPageInfo(null)
    }
  }, [
    effectiveBranch,
    effectiveRepoId,
    loadChartCommitsOnly,
    loadSessionsPageOnly,
    setSessionsPageInfo,
  ])

  useEffect(() => {
    if (!effectiveRepoId || !effectiveBranch) {
      setSessionRows([])
      setSessionsPageInfo(null)
      setRows([])
      setCommitsPageInfo(null)
      setCurrentSessionsRequest({ offset: 0 })
      setSelectedSessionId(null)
      setSelectedSessionSummary(null)
      setSelectedCheckpointId(null)
      return () => {
        dashboardAbortRef.current?.abort()
      }
    }

    setSessionsPageInfo(null)
    setCurrentSessionsRequest({ offset: 0 })
    const loadTimer = window.setTimeout(() => {
      void reloadDashboardForFilters()
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
      dashboardAbortRef.current?.abort()
    }
  }, [
    effectiveBranch,
    effectiveRepoId,
    from,
    reloadDashboardForFilters,
    selectedAgent,
    selectedUser,
    setCommitsPageInfo,
    setCurrentSessionsRequest,
    setRows,
    setSelectedCheckpointId,
    setSelectedSessionId,
    setSelectedSessionSummary,
    setSessionRows,
    setSessionsPageInfo,
    to,
  ])

  const visibleSessionsPageInfo = effectiveBranch ? sessionsPageInfo : null
  const sessionsHasNextPage = visibleSessionsPageInfo?.hasNextPage === true
  const sessionsHasPreviousPage =
    visibleSessionsPageInfo?.hasPreviousPage === true

  const onSessionsNext = useCallback(async () => {
    const offset = visibleSessionsPageInfo?.offset ?? 0
    if (!sessionsHasNextPage || !effectiveRepoId || !effectiveBranch) {
      return
    }
    setDataSource('loading')
    try {
      await loadSessionsPageOnly({ offset: offset + DASHBOARD_PAGE_SIZE })
      setDataSource('api')
    } catch (error: unknown) {
      console.error('Failed to load sessions page', error)
      setDataSource('error')
    }
  }, [
    effectiveBranch,
    effectiveRepoId,
    loadSessionsPageOnly,
    sessionsHasNextPage,
    visibleSessionsPageInfo?.offset,
  ])

  const onSessionsBack = useCallback(async () => {
    const offset = visibleSessionsPageInfo?.offset ?? 0
    if (!sessionsHasPreviousPage || !effectiveRepoId || !effectiveBranch) {
      return
    }
    setDataSource('loading')
    try {
      await loadSessionsPageOnly({
        offset: Math.max(0, offset - DASHBOARD_PAGE_SIZE),
      })
      setDataSource('api')
    } catch (error: unknown) {
      console.error('Failed to load sessions page', error)
      setDataSource('error')
    }
  }, [
    effectiveBranch,
    effectiveRepoId,
    loadSessionsPageOnly,
    sessionsHasPreviousPage,
    visibleSessionsPageInfo?.offset,
  ])

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
    setCurrentSessionsRequest({ offset: 0 })

    if (date && toDate && date > toDate) {
      setToDate(date)
    }
  }

  const onToDateSelect = (date: Date | undefined) => {
    setToDate(date)
    setCurrentCommitsRequest({ offset: 0 })
    setCurrentSessionsRequest({ offset: 0 })

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
      setSessionRows([])
      setCommitsPageInfo(null)
      setSessionsPageInfo(null)
      setSelectedCheckpointId(null)
      setSelectedSessionId(null)
      setSelectedSessionSummary(null)
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
    setSessionRows([])
    setCommitsPageInfo(null)
    setSessionsPageInfo(null)
    setSelectedCheckpointId(null)
    setSelectedSessionId(null)
    setSelectedSessionSummary(null)
    setCheckpointDetail(null)
    setCheckpointDetailSource('idle')
    setCurrentCommitsRequest({ offset: 0 })
    setCurrentSessionsRequest({ offset: 0 })
  }

  const onBranchChange = (value: string | null) => {
    setSelectedBranch(value)
    setCurrentCommitsRequest({ offset: 0 })
    setCurrentSessionsRequest({ offset: 0 })
  }

  const onUserChange = (value: string | null) => {
    setSelectedUser(value)
    setCurrentCommitsRequest({ offset: 0 })
    setCurrentSessionsRequest({ offset: 0 })
  }

  const onAgentChange = (value: string | null) => {
    setSelectedAgent(value)
    setCurrentCommitsRequest({ offset: 0 })
    setCurrentSessionsRequest({ offset: 0 })
  }

  const onCheckpointSelect = (checkpoint: Checkpoint) => {
    setSelectedCheckpointId(checkpoint.id)
    setCheckpointDetail(null)
    setCheckpointDetailSource('loading')
  }

  const onSessionSelect = (session: DashboardInteractionSessionDto) => {
    setSelectedSessionId(session.session_id)
    setSelectedSessionSummary(session)
  }

  const visibleSessionRows = effectiveBranch ? sessionRows : []
  const visibleRows = effectiveBranch ? rows : []
  const visibleUserOptions = effectiveBranch ? userOptions : []
  const visibleAgentOptions = effectiveBranch ? agentOptions : []
  const visibleSelectedUser = effectiveBranch ? selectedUser : null
  const visibleSelectedAgent = effectiveBranch ? selectedAgent : null
  const visibleDataSource: LoadState =
    dataSource === 'error' ? 'error' : effectiveBranch ? dataSource : 'api'

  return {
    sessionRows: visibleSessionRows,
    rows: visibleRows,
    repoOptions,
    branchOptions,
    userOptions: visibleUserOptions,
    agentOptions: visibleAgentOptions,
    selectedRepoId,
    effectiveRepoId,
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
    sessionsHasNextPage: visibleSessionsPageInfo?.hasNextPage === true,
    sessionsHasPreviousPage: effectiveBranch ? sessionsHasPreviousPage : false,
    onSessionsNext,
    onSessionsBack,
    selectedSessionId,
    selectedSessionSummary,
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
    onSessionSelect,
  }
}
