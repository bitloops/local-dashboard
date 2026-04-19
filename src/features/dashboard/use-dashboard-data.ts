import { useCallback, useEffect, useRef, useState } from 'react'
import { rootStoreInstance, useStore } from '@/store'
import { useShallow } from 'zustand/react/shallow'
import { syncQueryExplorerVariablesWithDashboardSelection } from '@/store/slices/query-explorer'
import type {
  DashboardInteractionSessionDto,
  DashboardInteractionUpdateDto,
} from './api-types'
import { type Checkpoint, type LoadState } from './types'
import {
  DASHBOARD_PAGE_SIZE,
  fetchDashboardAgents,
  fetchDashboardBranches,
  fetchDashboardCheckpointDetail,
  fetchDashboardCommitsPage,
  fetchDashboardInteractionSessionsPage,
  fetchDashboardRepositories,
  subscribeDashboardInteractionUpdates,
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

const REPO_CHECKOUT_UNKNOWN_PATTERN = /\brepo(?:sitory)? checkout unknown\b/i
const INTERACTION_UPDATES_POLL_INTERVAL_MS = 30_000

function isRepoCheckoutUnknownError(error: unknown): boolean {
  return error instanceof Error
    ? REPO_CHECKOUT_UNKNOWN_PATTERN.test(error.message)
    : false
}

function interactionUpdateKey(update: DashboardInteractionUpdateDto): string {
  return [
    update.repo_id,
    update.session_count,
    update.turn_count,
    update.latest_session_id ?? '',
    update.latest_session_updated_at ?? '',
    update.latest_turn_id ?? '',
    update.latest_turn_updated_at ?? '',
  ].join('|')
}

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
    currentSessionsRequest,
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
      currentSessionsRequest: state.currentSessionsRequest,
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
  const selectedSessionIdRef = useRef<string | null>(null)
  const refreshInteractionSessionsFromSubscriptionRef = useRef<
    () => Promise<void>
  >(async () => {})
  const [dataSource, setDataSource] = useState<'loading' | 'api' | 'error'>(
    'loading',
  )
  const [
    interactionUpdatesPollingFallback,
    setInteractionUpdatesPollingFallback,
  ] = useState(false)
  const [sessionDetailRefreshToken, setSessionDetailRefreshToken] = useState(0)
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
  const [unavailableRepoIds, setUnavailableRepoIds] = useState<string[]>([])
  const [validatedSelectedRepoId, setValidatedSelectedRepoId] = useState<
    string | null
  >(null)

  const dashboardAbortRef = useRef<AbortController | null>(null)
  const interactionRefreshInFlightRef = useRef(false)
  const interactionRefreshQueuedRef = useRef(false)
  const refreshSelectedSessionDetailRef = useRef(false)
  const lastInteractionUpdateKeyRef = useRef<string | null>(null)
  const autoSelectableRepoOptions = repoOptions.filter(
    (repo) => !unavailableRepoIds.includes(repo.repoId),
  )

  const selectedRepoOption =
    (selectedRepoId != null
      ? repoOptions.find((repo) => repo.repoId === selectedRepoId)
      : null) ?? null
  const autoQueryRepoOption =
    selectedRepoId == null ? (autoSelectableRepoOptions[0] ?? null) : null
  const hasValidatedSelectedRepo =
    selectedRepoId == null || validatedSelectedRepoId === selectedRepoId
  const effectiveRepoOption =
    selectedRepoId != null && hasValidatedSelectedRepo
      ? selectedRepoOption
      : autoQueryRepoOption
  const hasDashboardScope = effectiveRepoOption != null
  const queryRepoId = effectiveRepoOption?.repoId ?? null
  const effectiveRepoId = queryRepoId
  const effectiveRepoIdentity = effectiveRepoOption?.identity ?? null
  const defaultBranchFallback =
    effectiveRepoOption?.defaultBranch?.trim() || null
  const from = fromDate != null ? String(startOfDayUnixSeconds(fromDate)) : null
  const to = toDate != null ? String(endOfDayUnixSeconds(toDate)) : null
  const sinceRfc3339 = fromDate != null ? startOfDayIso(fromDate) : null
  const untilRfc3339 = toDate != null ? endOfDayIso(toDate) : null
  const branchOptionsRequestKey = `${queryRepoId ?? '__auto__'}:${from ?? ''}:${to ?? ''}`
  const visibleBranchOptionsSource: LoadState =
    branchOptionsRequestState.key !== branchOptionsRequestKey
      ? 'loading'
      : branchOptionsRequestState.source
  const effectiveBranch =
    selectedBranch ?? branchOptions[0] ?? defaultBranchFallback
  const interactionBranchFilter = selectedBranch
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
    selectedSessionIdRef.current = selectedSessionId
  }, [selectedSessionId])

  useEffect(() => {
    setInteractionUpdatesPollingFallback(false)
  }, [queryRepoId])

  const clearRepoScopedState = useCallback(() => {
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
  }, [
    setAgentOptions,
    setBranchOptions,
    setCheckpointDetail,
    setCheckpointDetailSource,
    setCommitsPageInfo,
    setCurrentCommitsRequest,
    setCurrentSessionsRequest,
    setRows,
    setSelectedAgent,
    setSelectedBranch,
    setSelectedCheckpointId,
    setSelectedSessionId,
    setSelectedSessionSummary,
    setSelectedUser,
    setSessionRows,
    setSessionsPageInfo,
    setUserOptions,
  ])

  const markRepoUnavailable = useCallback(
    (repoId: string, error: unknown): boolean => {
      if (!isRepoCheckoutUnknownError(error)) {
        return false
      }

      dashboardAbortRef.current?.abort()
      setUnavailableRepoIds((current) =>
        current.includes(repoId) ? current : [...current, repoId],
      )
      if (selectedRepoId === repoId) {
        setValidatedSelectedRepoId(null)
        setSelectedRepoId(null)
      }
      clearRepoScopedState()
      return true
    },
    [
      clearRepoScopedState,
      selectedRepoId,
      setSelectedRepoId,
      setValidatedSelectedRepoId,
    ],
  )

  useEffect(() => {
    let cancelled = false
    const previousSelectedRepoIdentity = selectedRepoOption?.identity ?? null

    fetchDashboardRepositories()
      .then((repositories) => {
        if (cancelled) {
          return
        }

        setRepoOptions(repositories)

        if (selectedRepoId == null) {
          setValidatedSelectedRepoId(null)
          setOptionsSource('api')
          return
        }

        const matchingRepo =
          repositories.find((repo) => repo.repoId === selectedRepoId) ??
          (previousSelectedRepoIdentity == null
            ? null
            : (repositories.find(
                (repo) => repo.identity === previousSelectedRepoIdentity,
              ) ?? null))

        if (matchingRepo == null) {
          setValidatedSelectedRepoId(null)
          setSelectedRepoId(null)
          clearRepoScopedState()
          setOptionsSource('api')
          return
        }

        setValidatedSelectedRepoId(matchingRepo.repoId)
        if (matchingRepo.repoId !== selectedRepoId) {
          setSelectedRepoId(matchingRepo.repoId)
        }
        setOptionsSource('api')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Failed to load repositories', error)
        setRepoOptions([])
        setValidatedSelectedRepoId(null)
        setOptionsSource('error')
      })

    return () => {
      cancelled = true
    }
  }, [
    clearRepoScopedState,
    selectedRepoOption?.identity,
    selectedRepoId,
    setRepoOptions,
    setSelectedRepoId,
  ])

  useEffect(() => {
    if (!hasDashboardScope) {
      setBranchOptions([])
      setBranchOptionsRequestState({
        key: branchOptionsRequestKey,
        source: 'api',
      })
      return
    }

    let cancelled = false

    fetchDashboardBranches({
      repoId: queryRepoId,
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
        if (queryRepoId != null && markRepoUnavailable(queryRepoId, error)) {
          return
        }
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
    from,
    hasDashboardScope,
    markRepoUnavailable,
    queryRepoId,
    selectedBranch,
    setBranchOptions,
    setSelectedBranch,
    to,
  ])

  useEffect(() => {
    if (!hasDashboardScope) {
      setUserOptions([])
      setAgentOptions([])
      return
    }
    if (!effectiveBranch) {
      return
    }

    let cancelled = false

    Promise.all([
      fetchDashboardUsers({
        repoId: queryRepoId,
        branch: effectiveBranch,
        from,
        to,
        agent: selectedAgent,
      }),
      fetchDashboardAgents({
        repoId: queryRepoId,
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
        if (queryRepoId != null && markRepoUnavailable(queryRepoId, error)) {
          return
        }
        console.error('Failed to load users or agents', error)
        setOptionsSource('error')
      })

    return () => {
      cancelled = true
    }
  }, [
    effectiveBranch,
    from,
    hasDashboardScope,
    markRepoUnavailable,
    queryRepoId,
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
      if (!hasDashboardScope || !effectiveBranch) {
        return
      }
      const commitsData = await fetchDashboardCommitsPage(
        {
          repoId: queryRepoId,
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
      from,
      hasDashboardScope,
      queryRepoId,
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
      if (!hasDashboardScope) {
        return
      }
      const sessionsData = await fetchDashboardInteractionSessionsPage(
        {
          repoId: queryRepoId,
          branch: interactionBranchFilter,
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
      setUserOptions(sessionsData.userOptions)
      if (
        selectedUser &&
        !sessionsData.userOptions.some(
          (option) => option.value === selectedUser,
        )
      ) {
        setSelectedUser(null)
        setCurrentCommitsRequest({ offset: 0 })
        setCurrentSessionsRequest({ offset: 0 })
      }
      setAgentOptions(sessionsData.agentOptions)
      if (selectedAgent && !sessionsData.agentOptions.includes(selectedAgent)) {
        setSelectedAgent(null)
        setCurrentCommitsRequest({ offset: 0 })
        setCurrentSessionsRequest({ offset: 0 })
      }
      const refreshedSelectedSession =
        selectedSessionId == null
          ? null
          : (sessionsData.rows.find(
              (session) => session.session_id === selectedSessionId,
            ) ?? null)
      setSessionRows(sessionsData.rows)
      setSessionsPageInfo({
        hasNextPage: sessionsData.hasNextPage,
        hasPreviousPage: sessionsReq.offset > 0,
        offset: sessionsReq.offset,
      })
      setCurrentSessionsRequest(sessionsReq)
      if (refreshedSelectedSession != null) {
        setSelectedSessionSummary(refreshedSelectedSession)
      }
    },
    [
      hasDashboardScope,
      interactionBranchFilter,
      queryRepoId,
      selectedAgent,
      selectedSessionId,
      selectedUser,
      setAgentOptions,
      setCurrentCommitsRequest,
      setCurrentSessionsRequest,
      setSessionRows,
      setSelectedAgent,
      setSelectedSessionSummary,
      setSelectedUser,
      setSessionsPageInfo,
      setUserOptions,
      sinceRfc3339,
      untilRfc3339,
    ],
  )

  const refreshInteractionSessionsFromSubscription = useCallback(async () => {
    if (!hasDashboardScope) {
      return
    }

    if (interactionRefreshInFlightRef.current) {
      interactionRefreshQueuedRef.current = true
      return
    }

    interactionRefreshInFlightRef.current = true

    try {
      await loadSessionsPageOnly(currentSessionsRequest)
      if (refreshSelectedSessionDetailRef.current) {
        refreshSelectedSessionDetailRef.current = false
        setSessionDetailRefreshToken((value) => value + 1)
      }
    } catch (error: unknown) {
      console.error(
        'Failed to refresh interaction sessions from subscription',
        error,
      )
    } finally {
      interactionRefreshInFlightRef.current = false
      if (interactionRefreshQueuedRef.current) {
        interactionRefreshQueuedRef.current = false
        void refreshInteractionSessionsFromSubscription()
      }
    }
  }, [currentSessionsRequest, hasDashboardScope, loadSessionsPageOnly])

  useEffect(() => {
    refreshInteractionSessionsFromSubscriptionRef.current =
      refreshInteractionSessionsFromSubscription
  }, [refreshInteractionSessionsFromSubscription])

  const reloadDashboardForFilters = useCallback(async () => {
    if (!hasDashboardScope) {
      return
    }

    dashboardAbortRef.current?.abort()
    const ac = new AbortController()
    dashboardAbortRef.current = ac

    setDataSource('loading')

    try {
      await loadSessionsPageOnly({ offset: 0 }, { signal: ac.signal })
      if (effectiveBranch) {
        await loadChartCommitsOnly(ac.signal)
      } else if (!ac.signal.aborted) {
        setRows([])
        setCommitsPageInfo(null)
      }
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
      if (queryRepoId != null && markRepoUnavailable(queryRepoId, error)) {
        return
      }
      console.error('Failed to load dashboard sessions/commits', error)
      setDataSource('error')
      setSessionsPageInfo(null)
    }
  }, [
    effectiveBranch,
    hasDashboardScope,
    loadChartCommitsOnly,
    loadSessionsPageOnly,
    markRepoUnavailable,
    queryRepoId,
    setCommitsPageInfo,
    setRows,
    setSessionsPageInfo,
  ])

  useEffect(() => {
    if (!hasDashboardScope) {
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
    from,
    hasDashboardScope,
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

  useEffect(() => {
    if (!hasDashboardScope) {
      lastInteractionUpdateKeyRef.current = null
      interactionRefreshInFlightRef.current = false
      interactionRefreshQueuedRef.current = false
      refreshSelectedSessionDetailRef.current = false
      return
    }

    if (interactionUpdatesPollingFallback) {
      return
    }

    lastInteractionUpdateKeyRef.current = null
    interactionRefreshInFlightRef.current = false
    interactionRefreshQueuedRef.current = false
    refreshSelectedSessionDetailRef.current = false

    return subscribeDashboardInteractionUpdates(
      { repoId: queryRepoId },
      {
        onUpdate: (update) => {
          const nextKey = interactionUpdateKey(update)
          const previousKey = lastInteractionUpdateKeyRef.current
          lastInteractionUpdateKeyRef.current = nextKey

          if (previousKey == null || previousKey === nextKey) {
            return
          }

          if (
            selectedSessionIdRef.current != null &&
            update.latest_session_id === selectedSessionIdRef.current
          ) {
            refreshSelectedSessionDetailRef.current = true
          }

          void refreshInteractionSessionsFromSubscriptionRef.current()
        },
        onError: (error: unknown) => {
          console.warn(
            'Dashboard interaction subscription unavailable; falling back to polling',
            error,
          )
          setInteractionUpdatesPollingFallback(true)
        },
      },
    )
  }, [hasDashboardScope, interactionUpdatesPollingFallback, queryRepoId])

  useEffect(() => {
    if (!interactionUpdatesPollingFallback || !hasDashboardScope) {
      return
    }

    const pollTimer = window.setInterval(() => {
      void refreshInteractionSessionsFromSubscriptionRef.current()
    }, INTERACTION_UPDATES_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(pollTimer)
    }
  }, [hasDashboardScope, interactionUpdatesPollingFallback])

  const visibleSessionsPageInfo = hasDashboardScope ? sessionsPageInfo : null
  const sessionsHasNextPage = visibleSessionsPageInfo?.hasNextPage === true
  const sessionsHasPreviousPage =
    visibleSessionsPageInfo?.hasPreviousPage === true

  const onSessionsNext = useCallback(async () => {
    const offset = visibleSessionsPageInfo?.offset ?? 0
    if (!sessionsHasNextPage || !hasDashboardScope) {
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
    hasDashboardScope,
    loadSessionsPageOnly,
    sessionsHasNextPage,
    visibleSessionsPageInfo?.offset,
  ])

  const onSessionsBack = useCallback(async () => {
    const offset = visibleSessionsPageInfo?.offset ?? 0
    if (!sessionsHasPreviousPage || !hasDashboardScope) {
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
    hasDashboardScope,
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

    fetchDashboardCheckpointDetail({
      repoId: queryRepoId,
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
    queryRepoId,
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
      clearRepoScopedState()
    }
  }

  const onRepoChange = (value: string | null) => {
    if (value != null) {
      setUnavailableRepoIds((current) =>
        current.filter((repoId) => repoId !== value),
      )
    }
    setValidatedSelectedRepoId(null)
    setSelectedRepoId(value)
    clearRepoScopedState()
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

  const visibleSessionRows = hasDashboardScope ? sessionRows : []
  const visibleRows = effectiveBranch ? rows : []
  const visibleUserOptions = hasDashboardScope ? userOptions : []
  const visibleAgentOptions = hasDashboardScope ? agentOptions : []
  const visibleSelectedUser = hasDashboardScope ? selectedUser : null
  const visibleSelectedAgent = hasDashboardScope ? selectedAgent : null
  const visibleDataSource: LoadState =
    dataSource === 'error' ? 'error' : hasDashboardScope ? dataSource : 'api'

  return {
    sessionRows: visibleSessionRows,
    rows: visibleRows,
    repoOptions,
    hasAnyRepositories: repoOptions.length > 0,
    hasAnyAutoSelectableRepositories: autoSelectableRepoOptions.length > 0,
    hasDashboardScope,
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
    sessionsHasPreviousPage: hasDashboardScope
      ? sessionsHasPreviousPage
      : false,
    onSessionsNext,
    onSessionsBack,
    selectedSessionId,
    selectedSessionSummary,
    selectedCheckpoint,
    checkpointDetail,
    checkpointDetailSource,
    sessionDetailRefreshToken,
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
