import { lazy, Suspense } from 'react'
import {
  type ApiCheckpointDetailResponse,
  type ApiCheckpointSessionDetailDto,
} from '@/api/types/schema'
import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ChatTranscript } from './chat-transcript'
import { FileTree } from './file-tree'
import { JsonHighlight } from './json-highlight'
import { type Checkpoint } from '../data/mock-commit-data'
import { type CheckpointDetailLoadState } from '../dashboard-view'

const TokenUsageChart = lazy(() =>
  import('./token-usage-chart').then((m) => ({ default: m.TokenUsageChart }))
)

type CheckpointSheetProps = {
  selectedCheckpoint: Checkpoint | null
  checkpointDetail: ApiCheckpointDetailResponse | null
  checkpointDetailSource: CheckpointDetailLoadState
  userName: string
  onClose: () => void
}

const formatDateTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

const prettyPrintJson = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) {
    return '-'
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    return JSON.stringify(parsed, null, 2)
  } catch {
    return value
  }
}

type ChatEntry = {
  role: string
  content: string
}

const parseTranscriptEntries = (jsonl: string): ChatEntry[] => {
  const lines = jsonl
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  return lines.map((line, index) => {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>
      const role =
        typeof parsed.role === 'string'
          ? parsed.role
          : typeof parsed.type === 'string'
            ? parsed.type
            : `entry-${index + 1}`

      const contentCandidate =
        parsed.content ?? parsed.text ?? parsed.message ?? parsed.delta ?? parsed
      const content =
        typeof contentCandidate === 'string'
          ? contentCandidate
          : JSON.stringify(contentCandidate, null, 2)

      return {
        role,
        content,
      }
    } catch {
      return {
        role: `line-${index + 1}`,
        content: line,
      }
    }
  })
}

export function CheckpointSheet({
  selectedCheckpoint,
  checkpointDetail,
  checkpointDetailSource,
  userName,
  onClose,
}: CheckpointSheetProps) {
  const selectedCheckpointCreatedAt = selectedCheckpoint?.createdAt
    ? new Date(selectedCheckpoint.createdAt).toLocaleString()
    : null

  const detailFilesTouched =
    checkpointDetail?.files_touched ?? selectedCheckpoint?.filesTouched ?? []
  const detailSessionCount =
    checkpointDetail?.session_count ?? selectedCheckpoint?.sessionCount ?? 0
  const detailCheckpointsCount =
    checkpointDetail?.checkpoints_count ?? selectedCheckpoint?.checkpointsCount ?? 0
  const detailStrategy =
    checkpointDetail?.strategy ?? selectedCheckpoint?.strategy ?? '-'
  const detailBranch = checkpointDetail?.branch ?? selectedCheckpoint?.branch ?? '-'
  const detailTokenUsage = checkpointDetail?.token_usage
  const detailSessions = checkpointDetail?.sessions ?? []

  const metadataJson = selectedCheckpoint
    ? JSON.stringify(
        {
          created: selectedCheckpoint.timestamp,
          created_at: selectedCheckpointCreatedAt ?? undefined,
          session_id: selectedCheckpoint.sessionId ?? undefined,
          strategy: detailStrategy,
          tool_use_id: selectedCheckpoint.toolUseId ?? undefined,
          commit: selectedCheckpoint.commit ?? undefined,
          sessions: detailSessionCount,
          checkpoints: detailCheckpointsCount,
        },
        null,
        2
      )
    : ''

  return (
    <Sheet
      open={Boolean(selectedCheckpoint)}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <SheetContent side='right' className='p-0' resizable defaultWidth={600} maxWidth={700}>
        <SheetHeader className='border-b pb-4 text-start'>
          <SheetTitle className='flex items-center gap-1'>
            {selectedCheckpoint
              ? `Checkpoint ${selectedCheckpoint.id}`
              : 'Checkpoint'}
            {selectedCheckpoint && (
              <CopyButton value={selectedCheckpoint.id} />
            )}
          </SheetTitle>
          <SheetDescription className='sr-only'>Checkpoint details</SheetDescription>
        </SheetHeader>

        <ScrollArea className='h-[calc(100%-88px)]'>
          <div className='space-y-5 p-4'>
            {selectedCheckpoint && (
              <>
                <div className='space-y-3'>
                  <div className='flex items-center gap-2'>
                    <Badge variant='outline'>
                      {selectedCheckpoint.isTask ? 'Task' : 'Prompt'}
                    </Badge>
                    {selectedCheckpoint.agent && (
                      <Badge variant='secondary'>{selectedCheckpoint.agent}</Badge>
                    )}
                    {detailBranch !== '-' && (
                      <Badge variant='secondary'>branch:{detailBranch}</Badge>
                    )}
                  </div>
                  <p className='rounded-md border bg-muted/30 p-3 text-sm'>
                    {selectedCheckpoint.prompt}
                  </p>
                </div>

                <div className='rounded-lg border bg-card p-3'>
                  <div className='grid grid-cols-2 gap-3 sm:grid-cols-4 sm:divide-x sm:divide-border sm:gap-0'>
                    <div className='sm:px-3 sm:first:ps-0 sm:last:pe-0'>
                      <p className='text-xs text-muted-foreground'>Files</p>
                      <p className='text-lg font-bold text-primary'>{detailFilesTouched.length}</p>
                    </div>
                    <div className='sm:px-3 sm:first:ps-0 sm:last:pe-0'>
                      <p className='text-xs text-muted-foreground'>Sessions</p>
                      <p className='text-lg font-bold text-primary'>{detailSessionCount}</p>
                    </div>
                    <div className='sm:px-3 sm:first:ps-0 sm:last:pe-0'>
                      <p className='text-xs text-muted-foreground'>Tokens</p>
                      <p className='text-lg font-bold text-primary'>
                        {detailTokenUsage
                          ? `${Math.round((detailTokenUsage.input_tokens + detailTokenUsage.output_tokens + detailTokenUsage.cache_read_tokens + detailTokenUsage.cache_creation_tokens) / 1000)}K`
                          : '-'}
                      </p>
                    </div>
                    <div className='sm:px-3 sm:first:ps-0 sm:last:pe-0'>
                      <p className='text-xs text-muted-foreground'>API Calls</p>
                      <p className='text-lg font-bold text-primary'>
                        {detailTokenUsage ? detailTokenUsage.api_call_count : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedCheckpoint.commitMessage && (
                  <>
                    <Separator />
                    <div>
                      <h3 className='mb-2 text-sm font-semibold'>Commit Message</h3>
                      <p className='rounded-md border bg-muted/30 p-3 text-sm'>
                        {selectedCheckpoint.commitMessage}
                      </p>
                    </div>
                  </>
                )}

                <Separator />

                <div>
                  <h3 className='mb-2 text-sm font-semibold'>Files Touched</h3>
                  {detailFilesTouched.length > 0 ? (
                    <div className='rounded-md border bg-muted/20 p-3'>
                      <FileTree paths={detailFilesTouched} />
                    </div>
                  ) : (
                    <p className='text-sm text-muted-foreground'>
                      No file information for this checkpoint.
                    </p>
                  )}
                </div>

                <Separator />
                <div>
                  <h3 className='mb-2 text-sm font-semibold'>Token Usage</h3>
                  <Suspense fallback={<div className='h-40 animate-pulse rounded-md bg-muted/30' />}>
                    <TokenUsageChart usage={detailTokenUsage} />
                  </Suspense>
                </div>

                <Separator />

                <div>
                  <div className='mb-2 flex items-center justify-between'>
                    <h3 className='text-sm font-semibold'>Metadata</h3>
                    <CopyButton value={metadataJson} />
                  </div>
                  <div className='max-h-60 overflow-auto rounded-md border bg-muted/20 p-3'>
                    <JsonHighlight value={metadataJson} />
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className='mb-2 text-sm font-semibold'>Chat Sessions</h3>
                  {checkpointDetailSource === 'loading' && (
                    <p className='text-sm text-muted-foreground'>
                      Loading chat data for this checkpoint…
                    </p>
                  )}
                  {checkpointDetailSource === 'error' && (
                    <p className='text-sm text-muted-foreground'>
                      Could not load chat data from `/api/checkpoint`.
                    </p>
                  )}
                  {checkpointDetailSource !== 'loading' &&
                    checkpointDetailSource !== 'error' &&
                    detailSessions.length === 0 && (
                      <p className='text-sm text-muted-foreground'>
                        No chat sessions were returned for this checkpoint.
                      </p>
                    )}

                  {detailSessions.length > 0 && (
                    <div className='space-y-3'>
                      {detailSessions.map(
                        (session: ApiCheckpointSessionDetailDto) => {
                          const transcriptEntries = parseTranscriptEntries(
                            session.transcript_jsonl
                          )

                          return (
                            <Card
                              key={`${session.session_id}-${session.session_index}`}
                              className='bg-muted/20'
                            >
                              <CardHeader className='pb-2'>
                                <CardTitle className='text-sm'>
                                  Session {session.session_index + 1}
                                </CardTitle>
                                <CardDescription className='flex items-center gap-1 font-mono text-xs'>
                                  {session.session_id}
                                  <CopyButton value={session.session_id} />
                                </CardDescription>
                              </CardHeader>
                              <CardContent className='space-y-3'>
                                <div className='flex flex-wrap gap-2'>
                                  <Badge variant='secondary'>{session.agent}</Badge>
                                  <Badge variant='outline'>
                                    {session.is_task ? 'Task' : 'Prompt'}
                                  </Badge>
                                  <Badge variant='outline'>
                                    {formatDateTime(session.created_at)}
                                  </Badge>
                                </div>

                                <div className='space-y-1'>
                                  <p className='text-xs text-muted-foreground'>
                                    Prompt(s)
                                  </p>
                                  <pre className='max-h-40 overflow-auto rounded-md border bg-background p-2 text-xs whitespace-pre-wrap break-words'>
                                    {session.prompts_text || '-'}
                                  </pre>
                                </div>

                                <div className='space-y-1'>
                                  <p className='text-xs text-muted-foreground'>
                                    Context
                                  </p>
                                  <pre className='max-h-40 overflow-auto rounded-md border bg-background p-2 text-xs whitespace-pre-wrap break-words'>
                                    {session.context_text || '-'}
                                  </pre>
                                </div>

                                <div className='space-y-1'>
                                  <div className='flex items-center justify-between'>
                                    <p className='text-xs text-muted-foreground'>
                                      Metadata JSON
                                    </p>
                                    <CopyButton value={prettyPrintJson(session.metadata_json)} />
                                  </div>
                                  <div className='max-h-36 overflow-auto rounded-md border bg-background p-2'>
                                    <JsonHighlight value={prettyPrintJson(session.metadata_json)} />
                                  </div>
                                </div>

                                <div className='space-y-1'>
                                  <p className='text-xs text-muted-foreground'>
                                    Transcript
                                  </p>
                                  <div className='max-h-72 overflow-auto rounded-md border bg-background p-2'>
                                    <ChatTranscript
                                      entries={transcriptEntries}
                                      sessionId={session.session_id}
                                      agentName={session.agent}
                                      userName={userName}
                                    />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        }
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
