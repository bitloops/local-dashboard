import {
  useLayoutEffect,
  useCallback,
  useState,
  useMemo,
  useEffect,
} from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sidebar, SidebarRail } from '@/components/ui/sidebar'
import { useSidebar } from '@/components/ui/use-sidebar'
import type {
  DashboardCheckpointDetailResponse,
  DashboardInteractionSessionDto,
} from '@/features/dashboard/api-types'
import { CheckpointSheet } from '@/features/dashboard/components/checkpoint-sheet'
import type { CheckpointDetailLoadState } from '@/features/dashboard/types'
import type { Checkpoint } from '@/features/dashboard/types'
import { fetchDashboardCheckpointDetail } from '@/features/dashboard/graphql/fetch-dashboard-data'
import { QueryExplorerLayout } from '@/features/query-explorer/components/query-explorer'
import { EditorHistoryContainer } from '@/features/query-explorer/components/editor-history-container'
import { useResizeWidth } from '@/features/query-explorer/hooks/use-resize-width'
import { SessionDetailSidebar } from '@/features/dashboard/components/session-detail-sidebar'
import { SessionsTable } from '@/features/dashboard/components/sessions-table'
import { rootStoreInstance, useStore } from '@/store'
import { runDashboardQueryExplorerQuery } from '@/features/sessions/run-dashboard-query'
import { SessionsCheckpointsTable } from '@/features/sessions/components/sessions-checkpoints-table'
import {
  deriveDedupedCheckpointsFromSessions,
  sessionsCheckpointRowToCheckpoint,
  type SessionsCheckpointRow,
} from '@/features/sessions/derive-sessions-checkpoints'
import {
  getDefaultInteractionSessionsVariables,
  SESSIONS_LANDING_DEFAULT_QUERY,
} from '@/features/sessions/default-interaction-sessions'
import {
  parseSessionsVariablesJson,
  setVariablesOffset,
} from '@/features/sessions/parse-sessions-variables'
import { useSessionsResultSync } from '@/features/sessions/use-sessions-result-sync'
import { SessionsVariablesPanel } from '@/features/sessions/components/sessions-variables-panel'
import { SessionsRepoBranchFilters } from '@/features/sessions/components/sessions-repo-branch-filters'

const EDITOR_PANEL_MIN = 280
const EDITOR_PANEL_MAX = 1200
const EDITOR_PANEL_DEFAULT = 780

/** Keeps tab panel height stable for at most `SESSIONS_LANDING_PAGE_SIZE` table rows (+ toolbar/chrome). */
const SESSIONS_TAB_PANEL_MIN_HEIGHT = 'min-h-[19.5rem]'

type SessionsMainTab = 'sessions' | 'checkpoints'

export function SessionsView() {
  const { setOpen, setRightOpen } = useSidebar()
  const [mainTab, setMainTab] = useState<SessionsMainTab>('sessions')
  const [checkpointSheetCheckpoint, setCheckpointSheetCheckpoint] =
    useState<Checkpoint | null>(null)
  const [checkpointDetail, setCheckpointDetail] =
    useState<DashboardCheckpointDetailResponse | null>(null)
  const [checkpointDetailSource, setCheckpointDetailSource] =
    useState<CheckpointDetailLoadState>('idle')
  const [editorPanelWidth, onResizeStart] = useResizeWidth({
    defaultWidth: EDITOR_PANEL_DEFAULT,
    minWidth: EDITOR_PANEL_MIN,
    maxWidth: EDITOR_PANEL_MAX,
  })

  const {
    setQuery,
    variables,
    setVariables,
    result,
    setVariablesHaveErrors,
    setResult,
    sessionRows,
    sessionsPageInfo,
    selectedSessionId,
    selectedSessionSummary,
    setSelectedSessionId,
    setSelectedSessionSummary,
    setSessionRows,
    setSessionsPageInfo,
    setCurrentSessionsRequest,
    sessionsLandingDefaultsApplied,
    setSessionsLandingDefaultsApplied,
  } = useStore(
    useShallow((s) => ({
      setQuery: s.setQuery,
      variables: s.variables,
      setVariables: s.setVariables,
      result: s.result,
      setVariablesHaveErrors: s.setVariablesHaveErrors,
      setResult: s.setResult,
      sessionRows: s.sessionRows,
      sessionsPageInfo: s.sessionsPageInfo,
      selectedSessionId: s.selectedSessionId,
      selectedSessionSummary: s.selectedSessionSummary,
      setSelectedSessionId: s.setSelectedSessionId,
      setSelectedSessionSummary: s.setSelectedSessionSummary,
      setSessionRows: s.setSessionRows,
      setSessionsPageInfo: s.setSessionsPageInfo,
      setCurrentSessionsRequest: s.setCurrentSessionsRequest,
      sessionsLandingDefaultsApplied: s.sessionsLandingDefaultsApplied,
      setSessionsLandingDefaultsApplied: s.setSessionsLandingDefaultsApplied,
    })),
  )

  useLayoutEffect(() => {
    if (sessionsLandingDefaultsApplied) return
    setQuery(SESSIONS_LANDING_DEFAULT_QUERY)
    setVariables(getDefaultInteractionSessionsVariables(null, null))
    setResult({ status: 'idle' })
    setSessionRows([])
    setSessionsPageInfo(null)
    setCurrentSessionsRequest({ offset: 0 })
    setSelectedSessionId(null)
    setSelectedSessionSummary(null)
    setSessionsLandingDefaultsApplied(true)
  }, [
    sessionsLandingDefaultsApplied,
    setQuery,
    setVariables,
    setResult,
    setSessionRows,
    setSessionsPageInfo,
    setCurrentSessionsRequest,
    setSelectedSessionId,
    setSelectedSessionSummary,
    setSessionsLandingDefaultsApplied,
  ])

  useSessionsResultSync({ variables })

  const parsedVars = parseSessionsVariablesJson(variables)
  const [resolvedRepoId, setResolvedRepoId] = useState<string | null>(null)

  /**
   * Auto-run the default sessions query once the landing defaults are applied and a
   * repo has been resolved, so the page lands with data present instead of an empty
   * idle table. Re-fires when the resolved repo changes (e.g. user switches repos).
   */
  useEffect(() => {
    if (!sessionsLandingDefaultsApplied) return
    if (!resolvedRepoId) return
    const state = rootStoreInstance.getState()
    void runDashboardQueryExplorerQuery({
      query: state.query,
      variables: state.variables,
    })
  }, [sessionsLandingDefaultsApplied, resolvedRepoId])

  const checkpointRows = useMemo(
    () => deriveDedupedCheckpointsFromSessions(sessionRows),
    [sessionRows],
  )

  useEffect(() => {
    if (checkpointDetailSource !== 'loading' || !checkpointSheetCheckpoint) {
      return
    }

    const ac = new AbortController()

    fetchDashboardCheckpointDetail(
      {
        repoId: resolvedRepoId,
        checkpointId: checkpointSheetCheckpoint.id,
      },
      { signal: ac.signal },
    )
      .then((detail) => {
        setCheckpointDetail(detail)
        setCheckpointDetailSource('api')
      })
      .catch((error: unknown) => {
        if (ac.signal.aborted) return
        console.error(
          `Failed to load checkpoint details for ${checkpointSheetCheckpoint.id}`,
          error,
        )
        setCheckpointDetail(null)
        setCheckpointDetailSource('error')
      })

    return () => {
      ac.abort()
    }
  }, [checkpointDetailSource, checkpointSheetCheckpoint, resolvedRepoId])

  const closeCheckpointSheet = useCallback(() => {
    setCheckpointSheetCheckpoint(null)
    setCheckpointDetail(null)
    setCheckpointDetailSource('idle')
  }, [])

  const handleSessionClick = (session: DashboardInteractionSessionDto) => {
    closeCheckpointSheet()
    setSelectedSessionId(session.session_id)
    setSelectedSessionSummary(session)
    setOpen(false)
    setRightOpen(true)
  }

  const handleCheckpointRowClick = useCallback(
    (row: SessionsCheckpointRow) => {
      setSelectedSessionId(null)
      setSelectedSessionSummary(null)
      setRightOpen(false)
      setCheckpointDetail(null)
      setCheckpointSheetCheckpoint(sessionsCheckpointRowToCheckpoint(row))
      setCheckpointDetailSource('loading')
    },
    [setRightOpen, setSelectedSessionId, setSelectedSessionSummary],
  )

  const userName = 'You'

  const onSessionsNext = useCallback(async () => {
    if (!sessionsPageInfo?.hasNextPage) return
    const { limit, offset } = parsedVars
    const nextVars = setVariablesOffset(variables, offset + limit)
    setVariables(nextVars)
    await runDashboardQueryExplorerQuery({
      query: rootStoreInstance.getState().query,
      variables: nextVars,
    })
  }, [sessionsPageInfo?.hasNextPage, parsedVars, variables, setVariables])

  const onSessionsBack = useCallback(async () => {
    if (!sessionsPageInfo?.hasPreviousPage) return
    const { limit, offset } = parsedVars
    const nextOffset = Math.max(0, offset - limit)
    const nextVars = setVariablesOffset(variables, nextOffset)
    setVariables(nextVars)
    await runDashboardQueryExplorerQuery({
      query: rootStoreInstance.getState().query,
      variables: nextVars,
    })
  }, [sessionsPageInfo?.hasPreviousPage, parsedVars, variables, setVariables])

  const dataSource =
    result.status === 'loading'
      ? 'loading'
      : result.status === 'error'
        ? 'error'
        : 'api'

  return (
    <>
      <Header className='pe-8'>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>
      <Main fixed>
        <div className='mb-4 flex min-h-0 flex-1 flex-col'>
          <div className='shrink-0'>
            <h1 className='text-2xl font-bold tracking-tight'>Sessions</h1>
          </div>
          <SessionsRepoBranchFilters
            value={variables}
            onChange={setVariables}
            onResolvedRepoIdChange={setResolvedRepoId}
            className='mt-2 shrink-0'
          />
          <QueryExplorerLayout
            className='mt-3 min-h-0 flex-1'
            editorPanelWidth={editorPanelWidth}
            onResizeStart={onResizeStart}
            separatorLabel='Resize editor and variables panels'
            leftPanel={
              <EditorHistoryContainer
                runQuery={runDashboardQueryExplorerQuery}
              />
            }
            rightPanel={
              <SessionsVariablesPanel
                value={variables}
                onChange={setVariables}
                onValidationChange={setVariablesHaveErrors}
                fillHeight
                className='flex h-full min-h-0 flex-col overflow-hidden bg-card'
              />
            }
          />

          {result.status === 'error' && (
            <p
              className='mt-2 rounded-md border border-dashed border-destructive/40 bg-destructive/5 px-2 py-1.5 text-xs text-destructive'
              role='alert'
            >
              {result.error}
            </p>
          )}

          <div className='mt-4 shrink-0'>
            <Tabs
              value={mainTab}
              onValueChange={(v) => setMainTab(v as SessionsMainTab)}
              className='w-full'
            >
              <div className='mb-3 flex h-9 shrink-0 flex-nowrap items-center justify-between gap-3'>
                <TabsList className='h-9 w-fit shrink-0'>
                  <TabsTrigger value='sessions' className='text-sm'>
                    Sessions
                  </TabsTrigger>
                  <TabsTrigger value='checkpoints' className='text-sm'>
                    Checkpoints
                  </TabsTrigger>
                </TabsList>
                <div className='flex shrink-0 items-center gap-1'>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='h-8 px-2'
                    disabled={
                      !sessionsPageInfo?.hasPreviousPage ||
                      dataSource === 'loading'
                    }
                    onClick={() => void onSessionsBack()}
                    aria-label='Previous sessions page'
                  >
                    <ChevronLeft className='h-4 w-4' />
                  </Button>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='h-8 px-2'
                    disabled={
                      !sessionsPageInfo?.hasNextPage || dataSource === 'loading'
                    }
                    onClick={() => void onSessionsNext()}
                    aria-label='Next sessions page'
                  >
                    <ChevronRight className='h-4 w-4' />
                  </Button>
                </div>
              </div>
              <TabsContent value='sessions' className='mt-0'>
                <div className={SESSIONS_TAB_PANEL_MIN_HEIGHT}>
                  <SessionsTable
                    data={sessionRows}
                    onSessionClick={handleSessionClick}
                  />
                </div>
              </TabsContent>
              <TabsContent value='checkpoints' className='mt-0'>
                <div
                  className={`flex flex-col ${SESSIONS_TAB_PANEL_MIN_HEIGHT}`}
                >
                  <p className='mb-3 shrink-0 text-xs text-muted-foreground'>
                    Checkpoints linked to interaction sessions on this page
                    (from <span className='font-mono'>linkedCheckpoints</span>).
                  </p>
                  <SessionsCheckpointsTable
                    rows={checkpointRows}
                    onCheckpointClick={handleCheckpointRowClick}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </Main>

      <Sidebar
        side='right'
        collapsible='offcanvas'
        resizable
        defaultWidth={600}
        minWidth={480}
        maxWidth={700}
      >
        <SidebarRail side='right' />
        <SessionDetailSidebar
          sessionId={selectedSessionId}
          sessionSummary={selectedSessionSummary}
          repoId={resolvedRepoId}
          userName={userName}
          onClose={() => {
            setRightOpen(false)
          }}
        />
      </Sidebar>

      <CheckpointSheet
        selectedCheckpoint={checkpointSheetCheckpoint}
        checkpointDetail={checkpointDetail}
        checkpointDetailSource={checkpointDetailSource}
        userName={userName}
        repoId={resolvedRepoId}
        onClose={closeCheckpointSheet}
      />
    </>
  )
}
