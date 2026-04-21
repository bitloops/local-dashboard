import { useLayoutEffect, useCallback, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Sidebar, SidebarRail } from '@/components/ui/sidebar'
import { useSidebar } from '@/components/ui/use-sidebar'
import type { DashboardInteractionSessionDto } from '@/features/dashboard/api-types'
import { QueryExplorerLayout } from '@/features/query-explorer/components/query-explorer'
import { EditorHistoryContainer } from '@/features/query-explorer/components/editor-history-container'
import { useResizeWidth } from '@/features/query-explorer/hooks/use-resize-width'
import { SessionDetailSidebar } from '@/features/dashboard/components/session-detail-sidebar'
import { SessionsTable } from '@/features/dashboard/components/sessions-table'
import { rootStoreInstance, useStore } from '@/store'
import { runDashboardQueryExplorerQuery } from '@/features/sessions/run-dashboard-query'
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

export function SessionsView() {
  const { setOpen, setRightOpen } = useSidebar()
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

  const handleSessionClick = (session: DashboardInteractionSessionDto) => {
    setSelectedSessionId(session.session_id)
    setSelectedSessionSummary(session)
    setOpen(false)
    setRightOpen(true)
  }

  const parsedVars = parseSessionsVariablesJson(variables)
  const [resolvedRepoId, setResolvedRepoId] = useState<string | null>(null)

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
            <p className='mt-1 text-sm text-muted-foreground'>
              Run queries against session data.
            </p>
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

          <div className='mt-6 min-h-0 shrink-0'>
            <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
              <h2 className='text-lg font-semibold tracking-tight'>Sessions</h2>
              <div className='flex items-center gap-1'>
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
            <SessionsTable
              data={sessionRows}
              onSessionClick={handleSessionClick}
            />
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
    </>
  )
}
