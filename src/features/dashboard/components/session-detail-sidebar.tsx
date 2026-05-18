import {
  lazy,
  startTransition,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  type DashboardInteractionSessionDetailResponse,
  type DashboardInteractionSessionDto,
} from '../api-types'
import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardDescription, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, XIcon } from 'lucide-react'
import { fetchDashboardInteractionSessionDetail } from '../graphql/fetch-dashboard-data'
import { formatAgentLabel, formatModelLabel } from '../utils'
import {
  formatDateTime,
  formatPromptForDisplay,
} from './checkpoint-sheet-utils'
import { SessionToolUseList } from '@/features/dashboard/components/session-tool-use-list'
import { sortedSessionToolUses } from '@/features/dashboard/utils/session-tool-uses'
import { buildSessionToolUseDisplayItems } from '@/features/dashboard/utils/session-tool-use-display'
import { FileTree } from './file-tree'
import { TurnsTimeline } from '@/features/dashboard/components/turns-timeline'
import { buildSessionTranscriptAnalysis } from '@/features/dashboard/utils/turn-transcript'

const TokenUsageChart = lazy(() =>
  import('./token-usage-chart').then((m) => ({ default: m.TokenUsageChart })),
)

function SessionSummaryView({
  summary,
  toolCallCount,
}: {
  summary: DashboardInteractionSessionDto
  /**
   * Computed by the parent using the same logic as the Tool use tab
   * (`buildSessionToolUseDisplayItems`) so the header tile never disagrees
   * with the list rendered under the Tool use tab. The fallback path matters
   * for sessions whose `tool_uses` summary array is empty but whose canonical
   * session transcript still contains `tool_use` / `tool_result` entries.
   */
  toolCallCount: number
}) {
  const firstPromptDisplay = formatPromptForDisplay(summary.first_prompt)

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <CardTitle className='text-base'>Session</CardTitle>
        <CardDescription className='flex items-center gap-1 font-mono text-xs'>
          {summary.session_id}
          <CopyButton value={summary.session_id} />
        </CardDescription>
      </div>
      <div className='flex flex-wrap gap-2'>
        <Badge variant='secondary'>
          {formatAgentLabel(summary.agent_type)}
        </Badge>
        {summary.model && (
          <Badge variant='outline'>{formatModelLabel(summary.model)}</Badge>
        )}
        {summary.branch && (
          <Badge variant='outline'>branch:{summary.branch}</Badge>
        )}
      </div>

      <div className='rounded-lg border bg-card p-3'>
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-4 sm:divide-x sm:divide-border sm:gap-0'>
          <div className='sm:px-3 sm:first:ps-0 sm:last:pe-0'>
            <p className='text-xs text-muted-foreground'>Files</p>
            <p className='text-lg font-bold text-primary'>
              {summary.file_paths.length}
            </p>
          </div>
          <div className='sm:px-3 sm:first:ps-0 sm:last:pe-0'>
            <p className='text-xs text-muted-foreground'>Turns</p>
            <p className='text-lg font-bold text-primary'>
              {summary.turn_count}
            </p>
          </div>
          <div className='sm:px-3 sm:first:ps-0 sm:last:pe-0'>
            <p className='text-xs text-muted-foreground'>Checkpoints</p>
            <p className='text-lg font-bold text-primary'>
              {summary.checkpoint_count}
            </p>
          </div>
          <div className='sm:px-3 sm:first:ps-0 sm:last:pe-0'>
            <p className='text-xs text-muted-foreground'>Tool calls</p>
            <p className='text-lg font-bold text-primary'>{toolCallCount}</p>
          </div>
        </div>
      </div>

      <div className='grid gap-3 text-sm sm:grid-cols-3'>
        <div>
          <p className='text-xs text-muted-foreground'>Started</p>
          <p>{formatDateTime(summary.started_at)}</p>
        </div>
        {summary.ended_at && (
          <div>
            <p className='text-xs text-muted-foreground'>Ended</p>
            <p>{formatDateTime(summary.ended_at)}</p>
          </div>
        )}
        {summary.last_event_at && (
          <div>
            <p className='text-xs text-muted-foreground'>Last event</p>
            <p>{formatDateTime(summary.last_event_at)}</p>
          </div>
        )}
      </div>

      <Separator />
      <div>
        <h3 className='mb-2 text-sm font-semibold'>Token Usage</h3>
        {/*
          Cursor does not expose reliable per-session token counts through its
          transcript or hooks, so any numbers we would otherwise show are
          incomplete. Treat Cursor sessions as having no token data regardless
          of what's stored.
        */}
        {summary.agent_type === 'cursor' ? (
          <p className='text-sm text-muted-foreground'>
            No token information available.
          </p>
        ) : summary.token_usage ? (
          <Suspense
            fallback={
              <div className='h-40 animate-pulse rounded-md bg-muted/30' />
            }
          >
            <TokenUsageChart usage={summary.token_usage} />
          </Suspense>
        ) : (
          <p className='text-sm text-muted-foreground'>
            No token usage data for this session.
          </p>
        )}
      </div>

      <Separator />
      {firstPromptDisplay && (
        <div>
          <p className='text-xs text-muted-foreground'>First prompt</p>
          <p className='rounded-md border bg-muted/30 p-2 text-sm whitespace-pre-wrap'>
            {firstPromptDisplay}
          </p>
        </div>
      )}
      {summary.actor && (summary.actor.name || summary.actor.email) && (
        <div>
          <p className='text-xs text-muted-foreground'>Actor</p>
          <p className='text-sm'>
            {summary.actor.name ?? summary.actor.email ?? summary.actor.id}
          </p>
        </div>
      )}
      {summary.file_paths.length > 0 && (
        <div>
          <h3 className='mb-2 text-sm font-semibold'>Files Touched</h3>
          <div className='max-h-64 overflow-auto rounded-md border bg-muted/20 p-3'>
            <FileTree paths={summary.file_paths} />
          </div>
        </div>
      )}
    </div>
  )
}

type SessionDetailSidebarProps = {
  sessionId: string | null
  repoId: string | null
  userName: string
  refreshToken?: number
  onClose?: () => void
}

type SessionDetailTab = 'details' | 'turns' | 'tools'

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

export function SessionDetailSidebar({
  sessionId,
  repoId,
  userName,
  refreshToken,
  onClose,
}: SessionDetailSidebarProps) {
  const interactionKey =
    sessionId?.trim() != null && sessionId.trim() !== ''
      ? `${repoId ?? ''}:${sessionId.trim()}:${refreshToken ?? 0}`
      : null

  const [interactionDetail, setInteractionDetail] =
    useState<DashboardInteractionSessionDetailResponse | null>(null)
  const [interactionSource, setInteractionSource] = useState<
    'idle' | 'loading' | 'api' | 'error'
  >('idle')
  const [interactionError, setInteractionError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SessionDetailTab>('details')
  // Track the previous interactionKey so we can reset state during render
  // when a new session is selected. Doing this in render (instead of an
  // effect) lets React discard the stale-state output before commit — so no
  // frame ever shows the old session's content under the new sessionId.
  // See react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [previousInteractionKey, setPreviousInteractionKey] = useState<
    string | null
  >(interactionKey)
  const interactionAbortRef = useRef<AbortController | null>(null)
  const loadedInteractionKeyRef = useRef<string | null>(null)

  if (previousInteractionKey !== interactionKey) {
    setPreviousInteractionKey(interactionKey)
    setInteractionDetail(null)
    setInteractionSource('idle')
    setInteractionError(null)
  }

  // Ref mutations aren't allowed during render, so the "loaded key" cache is
  // cleared in an effect that runs right before the fetch effect (effects
  // flush in declaration order). This ensures the fetch effect sees a clean
  // ref when interactionKey changes — including the K1 → K2 → K1 round-trip
  // case, where the old loaded-key value would otherwise cause an
  // erroneous early-return and leave the panel stuck on the spinner.
  useEffect(() => {
    loadedInteractionKeyRef.current = null
  }, [interactionKey])

  useEffect(() => {
    return () => {
      interactionAbortRef.current?.abort()
      interactionAbortRef.current = null
      loadedInteractionKeyRef.current = null
    }
  }, [])

  // Fetch the full session detail as soon as a session is selected (or the
  // selection / refresh token changes). The sidebar renders exclusively from
  // this response — there is no fallback to the list-query summary — so a
  // spinner takes the place of the panel content until it resolves.
  //
  // Note: `interactionDetail` deliberately does NOT appear in this effect's
  // dependency array. Re-running on detail change would force the cleanup
  // to abort the controller that just fired — turning a normal load into a
  // self-aborting double fetch. The reset effect above clears
  // `loadedInteractionKeyRef.current` synchronously when the key changes, so
  // the ref-based guard below is enough to answer "already loaded?".
  useEffect(() => {
    if (!sessionId?.trim() || !interactionKey) {
      return
    }

    if (loadedInteractionKeyRef.current === interactionKey) {
      return
    }

    const controller = new AbortController()
    interactionAbortRef.current?.abort()
    interactionAbortRef.current = controller

    startTransition(() => {
      setInteractionSource('loading')
      setInteractionError(null)
    })

    fetchDashboardInteractionSessionDetail(
      { repoId, sessionId },
      { signal: controller.signal },
    )
      .then((result) => {
        if (controller.signal.aborted) return
        loadedInteractionKeyRef.current = interactionKey
        setInteractionDetail(result)
        setInteractionSource('api')
      })
      .catch((err: unknown) => {
        if (isAbortError(err) || controller.signal.aborted) {
          return
        }
        setInteractionDetail(null)
        setInteractionSource('error')
        setInteractionError(
          err instanceof Error ? err.message : 'Failed to load session.',
        )
      })

    return () => {
      controller.abort()
      if (interactionAbortRef.current === controller) {
        interactionAbortRef.current = null
      }
    }
  }, [interactionKey, repoId, sessionId])

  const summary = interactionDetail?.summary ?? null
  const turns = interactionDetail?.turns ?? []
  const transcriptAnalysis = useMemo(
    () =>
      interactionDetail == null
        ? null
        : buildSessionTranscriptAnalysis(
            interactionDetail.turns,
            interactionDetail.session_transcript_entries,
          ),
    [interactionDetail],
  )
  const sessionToolsList = useMemo(
    () => (summary != null ? sortedSessionToolUses(summary) : null),
    [summary],
  )

  /**
   * Count the header tile shows under "Tool calls". Use the exact same
   * derivation as the Tool use tab (`buildSessionToolUseDisplayItems`), so
   * the two never disagree: when `summary.tool_uses` is empty but the
   * canonical session transcript still has `tool_use` / `tool_result`
   * entries, the count falls back to the transcript-derived traces — same
   * as what the tab renders.
   */
  const headerToolCallCount = useMemo(() => {
    if (sessionToolsList == null) return 0
    return buildSessionToolUseDisplayItems({
      tools: sessionToolsList,
      transcriptEntries: transcriptAnalysis?.sessionEntries ?? [],
    }).length
  }, [sessionToolsList, transcriptAnalysis])

  const headerSessionId = summary?.session_id ?? sessionId?.trim() ?? ''

  return (
    <>
      <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
        <div className='flex min-w-0 items-center justify-between gap-2 border-b px-4 py-4 pr-14 text-start'>
          <h2 className='flex min-w-0 items-center gap-1 text-lg font-semibold'>
            <span className='truncate'>Session</span>
            {headerSessionId && (
              <span className='font-mono text-sm text-muted-foreground'>
                {headerSessionId.slice(0, 10)}…
              </span>
            )}
            {headerSessionId && <CopyButton value={headerSessionId} />}
          </h2>
          {onClose && (
            <Button
              variant='ghost'
              size='icon'
              onClick={onClose}
              aria-label='Close session panel'
            >
              <XIcon className='size-4' />
            </Button>
          )}
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto overflow-x-hidden'>
          <div className='w-full min-w-0 space-y-4 p-4'>
            {/*
              The sidebar renders exclusively from `interactionDetail`. Show
              the spinner whenever we have a session key but no loaded
              summary yet and the request hasn't errored — this covers both
              the initial 'idle' frame before the fetch effect runs and the
              post-reset frame after `interactionKey` changes, not just the
              'loading' state. On error the body shows the error message
              and no tabs.
            */}
            {interactionKey != null &&
              summary == null &&
              interactionSource !== 'error' && (
                <div
                  className='flex min-h-40 items-center justify-center'
                  role='status'
                  aria-label='Loading session'
                >
                  <Loader2
                    className='size-6 shrink-0 animate-spin text-muted-foreground'
                    aria-hidden
                  />
                </div>
              )}
            {summary == null && interactionSource === 'error' && (
              <p className='text-sm text-muted-foreground'>
                {interactionError ?? 'Could not load interaction session.'}
              </p>
            )}
            {summary && (
              <Tabs
                value={activeTab}
                onValueChange={(value) => {
                  setActiveTab(value as SessionDetailTab)
                }}
                className='w-full'
              >
                <TabsList className='mb-2 grid w-full grid-cols-3'>
                  <TabsTrigger value='details'>Details</TabsTrigger>
                  <TabsTrigger value='turns'>Turns</TabsTrigger>
                  <TabsTrigger value='tools'>Tool use</TabsTrigger>
                </TabsList>
                <TabsContent value='details' className='mt-0'>
                  <SessionSummaryView
                    summary={summary}
                    toolCallCount={headerToolCallCount}
                  />
                </TabsContent>
                {/*
                  Tabs only render when `summary != null` (set above), which
                  means the detail request has resolved successfully. So the
                  Turns and Tool use panels never need their own loading or
                  error states — those live at the top-level body.
                */}
                <TabsContent value='turns' className='mt-0 space-y-2'>
                  {turns.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>No turns.</p>
                  ) : (
                    <TurnsTimeline
                      turns={turns}
                      userName={userName}
                      sections={transcriptAnalysis?.sections}
                    />
                  )}
                </TabsContent>
                <TabsContent value='tools' className='mt-0 space-y-2'>
                  <SessionToolUseList
                    tools={sessionToolsList ?? []}
                    transcriptEntries={transcriptAnalysis?.sessionEntries ?? []}
                    emptyMessage='No tool use entries.'
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
