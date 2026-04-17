import { useEffect, useState } from 'react'
import {
  type DashboardInteractionCommitAuthorDto,
  type DashboardInteractionSessionDetailResponse,
  type DashboardInteractionSessionDto,
  type DashboardInteractionToolUseDto,
  type DashboardInteractionTurnDto,
} from '../api-types'
import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { XIcon } from 'lucide-react'
import { fetchDashboardInteractionSessionDetail } from '../graphql/fetch-dashboard-data'
import { type Checkpoint } from '../types'
import { formatAgentLabel } from '../utils'
import { formatDateTime } from './checkpoint-sheet-utils'
import { TurnDetailModal } from './checkpoint-sheet'
import { CheckpointSummaryDialog } from './checkpoint-summary-dialog'

function checkpointStubFromLinked(
  c: DashboardInteractionCommitAuthorDto,
): Checkpoint {
  return {
    id: c.checkpoint_id,
    commit: c.commit_sha,
    timestamp: c.committed_at ?? '',
    author: c.name ?? undefined,
  }
}

function SessionSummaryView({ summary }: { summary: DashboardInteractionSessionDto }) {
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
        <Badge variant='secondary'>{formatAgentLabel(summary.agent_type)}</Badge>
        {summary.model && <Badge variant='outline'>{summary.model}</Badge>}
        {summary.branch && (
          <Badge variant='outline'>branch:{summary.branch}</Badge>
        )}
      </div>
      <div className='grid gap-2 text-sm'>
        <div>
          <p className='text-xs text-muted-foreground'>Started</p>
          <p>{summary.started_at}</p>
        </div>
        {summary.ended_at && (
          <div>
            <p className='text-xs text-muted-foreground'>Ended</p>
            <p>{summary.ended_at}</p>
          </div>
        )}
        {summary.last_event_at && (
          <div>
            <p className='text-xs text-muted-foreground'>Last event</p>
            <p>{summary.last_event_at}</p>
          </div>
        )}
        <div className='flex gap-4'>
          <div>
            <p className='text-xs text-muted-foreground'>Turns</p>
            <p className='font-medium'>{summary.turn_count}</p>
          </div>
          <div>
            <p className='text-xs text-muted-foreground'>Checkpoints</p>
            <p className='font-medium'>{summary.checkpoint_count}</p>
          </div>
        </div>
      </div>
      {summary.first_prompt && (
        <div>
          <p className='text-xs text-muted-foreground'>First prompt</p>
          <p className='rounded-md border bg-muted/30 p-2 text-sm whitespace-pre-wrap'>
            {summary.first_prompt}
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
          <p className='text-xs text-muted-foreground'>File paths</p>
          <ul className='max-h-32 list-inside list-disc overflow-auto text-sm'>
            {summary.file_paths.slice(0, 40).map((p) => (
              <li key={p} className='font-mono text-xs'>
                {p}
              </li>
            ))}
            {summary.file_paths.length > 40 && (
              <li className='text-muted-foreground'>
                +{summary.file_paths.length - 40} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function flattenToolUses(
  interactionDetail: DashboardInteractionSessionDetailResponse | null,
  turns: DashboardInteractionTurnDto[],
): Array<
  DashboardInteractionToolUseDto & { scope: 'session' | 'turn'; turnId?: string }
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
  onClose?: () => void
}

export function SessionDetailSidebar({
  sessionId,
  sessionSummary,
  repoId,
  userName,
  onClose,
}: SessionDetailSidebarProps) {
  const [interactionDetail, setInteractionDetail] =
    useState<DashboardInteractionSessionDetailResponse | null>(null)
  const [interactionSource, setInteractionSource] = useState<
    'idle' | 'loading' | 'api' | 'error'
  >('idle')
  const [interactionError, setInteractionError] = useState<string | null>(null)
  const [selectedTurn, setSelectedTurn] =
    useState<DashboardInteractionTurnDto | null>(null)
  const [checkpointModalOpen, setCheckpointModalOpen] = useState(false)
  const [modalCheckpointId, setModalCheckpointId] = useState<string | null>(
    null,
  )
  const [modalCheckpointStub, setModalCheckpointStub] =
    useState<Checkpoint | null>(null)

  useEffect(() => {
    if (!sessionId?.trim() || !repoId) {
      setInteractionDetail(null)
      setInteractionSource('idle')
      setInteractionError(null)
      return
    }

    let cancelled = false
    setInteractionSource('loading')
    setInteractionError(null)

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
  }, [sessionId, repoId])

  const summary = interactionDetail?.summary ?? sessionSummary
  const turns = interactionDetail?.turns ?? []
  const rawEvents = interactionDetail?.raw_events ?? []
  const tools = flattenToolUses(interactionDetail, turns)

  const openCheckpointModal = (linked: DashboardInteractionCommitAuthorDto) => {
    setModalCheckpointId(linked.checkpoint_id)
    setModalCheckpointStub(checkpointStubFromLinked(linked))
    setCheckpointModalOpen(true)
  }

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
                <TabsList className='mb-2 grid w-full grid-cols-4'>
                  <TabsTrigger value='details'>Details</TabsTrigger>
                  <TabsTrigger value='turns'>Turns</TabsTrigger>
                  <TabsTrigger value='checkpoints'>Checkpoints</TabsTrigger>
                  <TabsTrigger value='tools'>Tool use</TabsTrigger>
                </TabsList>
                <TabsContent value='details' className='mt-0'>
                  <SessionSummaryView summary={summary} />
                </TabsContent>
                <TabsContent value='turns' className='mt-0 space-y-2'>
                  {turns.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>No turns.</p>
                  ) : (
                    turns.map((turn) => (
                      <button
                        key={turn.turn_id}
                        type='button'
                        className='w-full rounded-md border bg-background px-3 py-2 text-left hover:bg-muted/40'
                        onClick={() => setSelectedTurn(turn)}
                      >
                        <div className='flex items-start justify-between gap-2'>
                          <div className='min-w-0'>
                            <p className='text-sm font-medium'>
                              Turn {turn.turn_number}
                            </p>
                            <p className='line-clamp-2 text-xs text-muted-foreground'>
                              {turn.prompt ?? turn.summary ?? '-'}
                            </p>
                          </div>
                          <div className='flex shrink-0 flex-col items-end gap-1'>
                            {turn.checkpoint_id && (
                              <Badge variant='secondary'>checkpoint</Badge>
                            )}
                            <Badge variant='outline'>
                              {turn.files_modified.length} files
                            </Badge>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </TabsContent>
                <TabsContent value='checkpoints' className='mt-0 space-y-2'>
                  {summary.linked_checkpoints.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      No linked checkpoints.
                    </p>
                  ) : (
                    summary.linked_checkpoints.map((c) => (
                      <Card
                        key={`${c.checkpoint_id}-${c.commit_sha}`}
                        className='cursor-pointer bg-muted/20 p-3 transition-colors hover:bg-muted/40'
                        onClick={() => openCheckpointModal(c)}
                      >
                        <p className='font-mono text-xs'>{c.checkpoint_id}</p>
                        <p className='text-xs text-muted-foreground'>
                          {c.commit_sha.slice(0, 12)}…
                        </p>
                        {(c.name || c.email) && (
                          <p className='mt-1 text-xs'>
                            {c.name ?? c.email ?? ''}
                          </p>
                        )}
                      </Card>
                    ))
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
                          {tool.turnId && (
                            <Badge variant='outline'>turn</Badge>
                          )}
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

      {selectedTurn && (
        <TurnDetailModal
          turn={selectedTurn}
          rawEvents={rawEvents}
          userName={userName}
          onClose={() => setSelectedTurn(null)}
        />
      )}

      <CheckpointSummaryDialog
        open={checkpointModalOpen}
        onOpenChange={(open) => {
          setCheckpointModalOpen(open)
          if (!open) {
            setModalCheckpointId(null)
            setModalCheckpointStub(null)
          }
        }}
        repoId={repoId}
        checkpointId={modalCheckpointId}
        checkpointStub={modalCheckpointStub}
      />
    </>
  )
}
