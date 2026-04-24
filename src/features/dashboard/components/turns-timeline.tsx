import { lazy, Suspense, useMemo, useState } from 'react'
import type {
  DashboardInteractionEventDto,
  DashboardInteractionTurnDto,
} from '@/features/dashboard/api-types'
import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatAgentLabel } from '@/features/dashboard/utils'
import {
  formatDateTime,
  formatPromptForDisplay,
} from '@/features/dashboard/components/checkpoint-sheet-utils'
import { FileTree } from '@/features/dashboard/components/file-tree'
import { ChatTranscript } from '@/features/dashboard/components/chat-transcript'
import { buildTranscriptSectionsForTurns } from '@/features/dashboard/utils/turn-transcript'

const TokenUsageChart = lazy(() =>
  import('./token-usage-chart').then((m) => ({ default: m.TokenUsageChart })),
)

type TurnsTimelineProps = {
  turns: DashboardInteractionTurnDto[]
  rawEvents: DashboardInteractionEventDto[]
  userName: string
}

function TurnDetailsPanel({ turn }: { turn: DashboardInteractionTurnDto }) {
  const actorLine =
    turn.actor?.name?.trim() ||
    turn.actor?.email?.trim() ||
    turn.actor?.id?.trim() ||
    null

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-xs text-muted-foreground'>
          Turn {turn.turn_number}
        </span>
        <Badge variant='secondary'>{formatAgentLabel(turn.agent_type)}</Badge>
        {turn.model ? (
          <Badge variant='outline' className='max-w-[200px] truncate'>
            {turn.model}
          </Badge>
        ) : null}
        <Badge variant='outline'>{formatDateTime(turn.started_at)}</Badge>
        {turn.ended_at ? (
          <Badge variant='outline'>ended {formatDateTime(turn.ended_at)}</Badge>
        ) : null}
        {turn.checkpoint_id ? (
          <Badge variant='secondary'>checkpoint</Badge>
        ) : null}
        {turn.branch?.trim() ? (
          <Badge variant='outline' className='max-w-[220px] truncate'>
            branch:{turn.branch.trim()}
          </Badge>
        ) : null}
      </div>

      <div className='flex flex-wrap gap-3 text-xs text-muted-foreground'>
        <span className='inline-flex min-w-0 items-center gap-1'>
          <span className='shrink-0'>turn</span>
          <span className='min-w-0 break-all font-mono'>{turn.turn_id}</span>
          <CopyButton value={turn.turn_id} />
        </span>
        <span className='inline-flex min-w-0 items-center gap-1'>
          <span className='shrink-0'>session</span>
          <span className='min-w-0 break-all font-mono'>{turn.session_id}</span>
          <CopyButton value={turn.session_id} />
        </span>
      </div>

      {actorLine ? (
        <div className='space-y-1'>
          <p className='text-xs text-muted-foreground'>Actor</p>
          <p className='text-sm'>{actorLine}</p>
        </div>
      ) : null}

      {turn.summary?.trim() ? (
        <div className='space-y-1'>
          <p className='text-xs text-muted-foreground'>Summary</p>
          <p className='rounded-md border bg-muted/20 p-3 text-sm whitespace-pre-wrap break-words'>
            {formatPromptForDisplay(turn.summary) || '-'}
          </p>
        </div>
      ) : null}

      <div className='space-y-1'>
        <p className='text-xs text-muted-foreground'>Prompt</p>
        <p className='rounded-md border bg-muted/20 p-3 text-sm whitespace-pre-wrap break-words'>
          {formatPromptForDisplay(turn.prompt) || '-'}
        </p>
      </div>

      <div className='space-y-1'>
        <p className='text-xs text-muted-foreground'>Token usage</p>
        {turn.token_usage ? (
          <div className='space-y-3'>
            <div className='text-sm text-muted-foreground'>
              {turn.token_usage.input_tokens +
                turn.token_usage.output_tokens +
                turn.token_usage.cache_read_tokens +
                turn.token_usage.cache_creation_tokens}{' '}
              tokens
            </div>
            <Suspense
              fallback={
                <div className='h-40 animate-pulse rounded-md bg-muted/30' />
              }
            >
              <TokenUsageChart usage={turn.token_usage} />
            </Suspense>
          </div>
        ) : (
          <p className='text-sm text-muted-foreground'>
            No token usage data for this turn.
          </p>
        )}
      </div>

      <div className='space-y-1'>
        <p className='text-xs text-muted-foreground'>Files touched</p>
        {turn.files_modified.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            No files modified for this turn.
          </p>
        ) : (
          <div className='max-h-64 overflow-auto rounded-md border bg-muted/20 p-3'>
            <FileTree paths={turn.files_modified} />
          </div>
        )}
      </div>
    </div>
  )
}

export function TurnsTimeline({
  turns,
  rawEvents,
  userName,
}: TurnsTimelineProps) {
  const [openTurnIds, setOpenTurnIds] = useState<Record<string, boolean>>({})

  const sections = useMemo(
    () => buildTranscriptSectionsForTurns(rawEvents, turns),
    [rawEvents, turns],
  )

  return (
    <div className='space-y-10'>
      {sections.map(({ turn, entries }, index) => {
        const isOpen = openTurnIds[turn.turn_id] === true
        const detailsId = `turn-details-${turn.turn_id}`
        return (
          <section
            key={`${turn.session_id}-${turn.turn_number}-${turn.turn_id}`}
            aria-label={`Turn ${turn.turn_number}`}
            className='space-y-2'
          >
            {index > 0 ? <Separator className='mb-8' /> : null}

            <div className='min-w-0'>
              {entries.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  No transcript fragment available for this turn.
                </p>
              ) : (
                <ChatTranscript
                  entries={entries}
                  sessionId={turn.session_id}
                  agentName={formatAgentLabel(turn.agent_type)}
                  userName={userName}
                />
              )}
            </div>

            <div className='border-t border-border/50 pt-2'>
              <button
                type='button'
                className='text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline'
                aria-expanded={isOpen}
                aria-controls={detailsId}
                onClick={() =>
                  setOpenTurnIds((prev) => ({
                    ...prev,
                    [turn.turn_id]: !isOpen,
                  }))
                }
              >
                {isOpen ? 'Hide details' : 'Show details'}
              </button>
            </div>

            {isOpen ? (
              <div
                id={detailsId}
                role='region'
                aria-label={`Turn ${turn.turn_number} details`}
                className='border-t border-border/40 pt-4'
              >
                <TurnDetailsPanel turn={turn} />
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
