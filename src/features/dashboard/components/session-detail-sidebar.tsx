import { lazy, startTransition, Suspense, useEffect, useState } from 'react'
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
import { XIcon } from 'lucide-react'
import { fetchDashboardInteractionSessionDetail } from '../graphql/fetch-dashboard-data'
import { formatAgentLabel } from '../utils'
import {
  formatDateTime,
  formatPromptForDisplay,
} from './checkpoint-sheet-utils'
import { InteractionToolUseEntry } from '@/features/dashboard/components/interaction-tool-use-entry'
import { sortedSessionToolUses } from '@/features/dashboard/utils/session-tool-uses'
import { FileTree } from './file-tree'
import { TurnsTimeline } from '@/features/dashboard/components/turns-timeline'

const TokenUsageChart = lazy(() =>
  import('./token-usage-chart').then((m) => ({ default: m.TokenUsageChart })),
)

function SessionSummaryView({
  summary,
}: {
  summary: DashboardInteractionSessionDto
}) {
  const toolCallCount = summary.tool_uses.length
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
        {summary.model && <Badge variant='outline'>{summary.model}</Badge>}
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
        {summary.token_usage ? (
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
  sessionSummary: DashboardInteractionSessionDto | null
  repoId: string | null
  userName: string
  refreshToken?: number
  onClose?: () => void
}

export function SessionDetailSidebar({
  sessionId,
  sessionSummary,
  repoId,
  userName,
  refreshToken,
  onClose,
}: SessionDetailSidebarProps) {
  const [interactionDetail, setInteractionDetail] =
    useState<DashboardInteractionSessionDetailResponse | null>(null)
  const [interactionSource, setInteractionSource] = useState<
    'idle' | 'loading' | 'api' | 'error'
  >('idle')
  const [interactionError, setInteractionError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId?.trim()) {
      startTransition(() => {
        setInteractionDetail(null)
        setInteractionSource('idle')
        setInteractionError(null)
      })
      return
    }

    let cancelled = false
    startTransition(() => {
      setInteractionSource('loading')
      setInteractionError(null)
      setInteractionDetail(null)
    })

    fetchDashboardInteractionSessionDetail({ repoId, sessionId })
      .then((result) => {
        if (cancelled) return
        setInteractionDetail(result)
        setInteractionSource('api')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setInteractionDetail(null)
        setInteractionSource('error')
        setInteractionError(
          err instanceof Error ? err.message : 'Failed to load session.',
        )
      })

    return () => {
      cancelled = true
    }
  }, [refreshToken, repoId, sessionId])

  const summary = interactionDetail?.summary ?? sessionSummary
  const turns = interactionDetail?.turns ?? []
  const rawEvents = interactionDetail?.raw_events ?? []
  /** List query does not fetch `toolUses`; only session detail does. Avoid showing empty until detail returns. */
  const sessionToolsList =
    interactionDetail?.summary != null
      ? sortedSessionToolUses(interactionDetail.summary)
      : null

  return (
    <>
      <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
        <div className='flex min-w-0 items-center justify-between gap-2 border-b px-4 py-4 pr-14 text-start'>
          <h2 className='flex min-w-0 items-center gap-1 text-lg font-semibold'>
            <span className='truncate'>Session</span>
            {summary && (
              <span className='font-mono text-sm text-muted-foreground'>
                {summary.session_id.slice(0, 10)}…
              </span>
            )}
            {summary && <CopyButton value={summary.session_id} />}
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
            {interactionSource === 'loading' && (
              <p className='text-sm text-muted-foreground'>Loading session…</p>
            )}
            {interactionSource === 'error' && (
              <p className='text-sm text-muted-foreground'>
                {interactionError ?? 'Could not load interaction session.'}
              </p>
            )}
            {(interactionSource === 'api' || sessionSummary) && summary && (
              <Tabs defaultValue='details' className='w-full'>
                <TabsList className='mb-2 grid w-full grid-cols-3'>
                  <TabsTrigger value='details'>Details</TabsTrigger>
                  <TabsTrigger value='turns'>Turns</TabsTrigger>
                  <TabsTrigger value='tools'>Tool use</TabsTrigger>
                </TabsList>
                <TabsContent value='details' className='mt-0'>
                  <SessionSummaryView summary={summary} />
                </TabsContent>
                <TabsContent value='turns' className='mt-0 space-y-2'>
                  {turns.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>No turns.</p>
                  ) : (
                    <TurnsTimeline
                      turns={turns}
                      rawEvents={rawEvents}
                      userName={userName}
                    />
                  )}
                </TabsContent>
                <TabsContent value='tools' className='mt-0 space-y-2'>
                  {interactionSource === 'error' ? (
                    <p className='text-sm text-muted-foreground'>
                      Could not load session detail; tool uses are unavailable.
                    </p>
                  ) : interactionSource === 'loading' ||
                    sessionToolsList === null ? (
                    <p className='text-sm text-muted-foreground'>
                      Loading tool uses…
                    </p>
                  ) : sessionToolsList.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      No tool use entries.
                    </p>
                  ) : (
                    sessionToolsList.map((tool) => (
                      <InteractionToolUseEntry
                        key={
                          tool.tool_invocation_id ||
                          `${tool.tool_use_id}-${tool.started_at ?? ''}`
                        }
                        tool={tool}
                      />
                    ))
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
