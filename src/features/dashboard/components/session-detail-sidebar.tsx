import { lazy, startTransition, Suspense, useEffect, useState } from 'react'
import {
  type DashboardInteractionSessionDetailResponse,
  type DashboardInteractionSessionDto,
  type DashboardInteractionToolUseDto,
  type DashboardInteractionTurnDto,
} from '../api-types'
import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardDescription, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { XIcon } from 'lucide-react'
import { fetchDashboardInteractionSessionDetail } from '../graphql/fetch-dashboard-data'
import { formatAgentLabel } from '../utils'
import { formatDateTime, formatPromptForDisplay } from './checkpoint-sheet-utils'
import { FileTree } from './file-tree'
import { TurnDetailContent } from './checkpoint-sheet'

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

function flattenToolUses(
  interactionDetail: DashboardInteractionSessionDetailResponse | null,
  turns: DashboardInteractionTurnDto[],
): Array<
  DashboardInteractionToolUseDto & {
    scope: 'session' | 'turn'
    turnId?: string
  }
> {
  const sessionTools =
    interactionDetail?.summary?.tool_uses?.map((t) => ({
      ...t,
      scope: 'session' as const,
    })) ?? []
  const turnTools = turns.flatMap((turn) =>
    (turn.tool_uses ?? []).map((t) => ({
      ...t,
      scope: 'turn' as const,
      turnId: turn.turn_id,
    })),
  )
  return [...sessionTools, ...turnTools]
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
  const tools = flattenToolUses(interactionDetail, turns)

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
                    <Accordion
                      key={summary.session_id}
                      type='single'
                      collapsible
                      className='flex w-full flex-col gap-3'
                    >
                      {turns.map((turn) => (
                        <AccordionItem
                          key={turn.turn_id}
                          value={turn.turn_id}
                          variant='card'
                        >
                          <AccordionTrigger className='px-4 py-3 hover:bg-muted/50 hover:no-underline [&[data-state=open]]:bg-muted/40'>
                            <div className='flex min-w-0 flex-1 items-start justify-between gap-2 text-start'>
                              <div className='min-w-0'>
                                <p className='text-sm font-medium'>
                                  {turn.turn_number}
                                </p>
                                <p className='line-clamp-2 text-xs text-muted-foreground'>
                                  {formatPromptForDisplay(
                                    turn.prompt ?? turn.summary ?? '',
                                  ) || '-'}
                                </p>
                              </div>
                              <div className='flex shrink-0 flex-col items-end gap-1 pe-1'>
                                {turn.checkpoint_id && (
                                  <Badge variant='secondary'>checkpoint</Badge>
                                )}
                                <div className='flex flex-wrap items-center justify-end gap-1'>
                                  {turn.model && (
                                    <Badge
                                      variant='outline'
                                      className='max-w-[140px] truncate'
                                    >
                                      {turn.model}
                                    </Badge>
                                  )}
                                  <Badge variant='outline'>
                                    {turn.files_modified.length} files
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className='border-t border-border px-4 pb-4 pt-4'>
                            <TurnDetailContent
                              turn={turn}
                              rawEvents={rawEvents}
                              userName={userName}
                            />
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </TabsContent>
                <TabsContent value='tools' className='mt-0 space-y-2'>
                  {tools.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      No tool use entries.
                    </p>
                  ) : (
                    tools.map((tool) => (
                      <div
                        key={`${tool.scope}-${tool.tool_use_id}-${tool.turnId ?? ''}`}
                        className='rounded-md border bg-background px-3 py-2'
                      >
                        <div className='flex flex-wrap items-center gap-2'>
                          <Badge variant='secondary'>
                            {tool.tool_kind ?? 'tool'}
                          </Badge>
                          {tool.turnId && <Badge variant='outline'>turn</Badge>}
                          {tool.started_at && (
                            <Badge variant='outline'>
                              {formatDateTime(tool.started_at)}
                            </Badge>
                          )}
                        </div>
                        {tool.task_description && (
                          <p className='mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words'>
                            {tool.task_description}
                          </p>
                        )}
                        <p className='mt-1 break-all font-mono text-[11px] text-muted-foreground'>
                          {tool.tool_use_id}
                        </p>
                      </div>
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
