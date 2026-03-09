import { lazy, Suspense, useEffect, useState } from 'react'
import {
  type ApiCheckpointDetailResponse,
  type ApiCheckpointSessionDetailDto,
} from '@/api/types/schema'
import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Card,
  CardDescription,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { XIcon } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import { ChatTranscript, codeBlockStyle } from './chat-transcript'
import { FileTree } from './file-tree'
import { type Checkpoint } from '../data/mock-commit-data'
import { type CheckpointDetailLoadState } from '../dashboard-view'
import { formatAgentLabel } from '../utils'
import {
  formatDateTime,
  parseTranscriptEntries,
  stripUserQueryTags,
  prettyPrintJson,
} from './checkpoint-sheet-utils'

SyntaxHighlighter.registerLanguage('json', json)

const TokenUsageChart = lazy(() =>
  import('./token-usage-chart').then((m) => ({ default: m.TokenUsageChart }))
)

export type CheckpointDetailContentProps = {
  selectedCheckpoint: Checkpoint | null
  checkpointDetail: ApiCheckpointDetailResponse | null
  checkpointDetailSource: CheckpointDetailLoadState
  userName: string
  /** When provided, a close button is shown in the header (e.g. when used inside Sidebar). */
  onClose?: () => void
}

type CheckpointSheetProps = CheckpointDetailContentProps & {
  onClose: () => void
}

type SheetViewMode = 'session' | 'summary'

/** Inner content for checkpoint detail. Use inside Sheet (CheckpointSheet) or Sidebar. */
export function CheckpointDetailContent(props: CheckpointDetailContentProps) {
  return <CheckpointDetailContentInner {...props} />
}

function CheckpointDetailContentInner({
  selectedCheckpoint,
  checkpointDetail,
  checkpointDetailSource,
  userName,
  onClose,
}: CheckpointDetailContentProps) {
  const [viewMode, setViewMode] = useState<SheetViewMode>('session')
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0)

  useEffect(() => {
    setSelectedSessionIndex(0)
  }, [selectedCheckpoint?.id])

  const selectedCheckpointCreatedAt = selectedCheckpoint?.createdAt
    ? formatDateTime(selectedCheckpoint.createdAt)
    : null

  const detailFilesTouched: Record<string, { additionsCount: number; deletionsCount: number }> =
    checkpointDetail?.files_touched ?? selectedCheckpoint?.filesTouched ?? {}
  const detailFilesPaths = Object.keys(detailFilesTouched)
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
    <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
      <div className='flex items-center justify-between gap-2 border-b pt-4 pb-4 pl-4 text-start'>
        <h2 className='flex items-center gap-1 text-lg font-semibold'>
          {selectedCheckpoint
            ? `Checkpoint ${selectedCheckpoint.id}`
            : 'Checkpoint'}
          {selectedCheckpoint && (
            <CopyButton value={selectedCheckpoint.id} />
          )}
        </h2>
        {onClose && (
          <Button variant='ghost' size='icon' onClick={onClose} aria-label='Close checkpoint panel'>
            <XIcon className='size-4' />
          </Button>
        )}
      </div>

      <ScrollArea className='h-[calc(100%-88px)]'>
        <div className='min-w-0 space-y-5 p-4'>
          {selectedCheckpoint && (
            <>
              <div className='space-y-3'>
                <div className='flex items-center gap-2'>
                  {detailBranch !== '-' && (
                    <Badge variant='secondary'>branch:{detailBranch}</Badge>
                  )}
                </div>
              </div>

              <div
                className='flex w-full rounded-lg border border-border bg-muted/40 p-0.5'
                role='tablist'
                aria-label='View mode'
              >
                <button
                  type='button'
                  role='tab'
                  aria-selected={viewMode === 'session'}
                  onClick={() => setViewMode('session')}
                  className={cn(
                    'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    viewMode === 'session'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Session
                </button>
                <button
                  type='button'
                  role='tab'
                  aria-selected={viewMode === 'summary'}
                  onClick={() => setViewMode('summary')}
                  className={cn(
                    'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    viewMode === 'summary'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Details
                </button>
              </div>

              {viewMode === 'session' && (
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
                    <Card className='overflow-hidden bg-muted/20 pt-0'>
                      <Tabs
                        value={String(selectedSessionIndex)}
                        onValueChange={(v: string) => setSelectedSessionIndex(Number(v))}
                      >
                        <TabsList variant='line' className='h-auto justify-start rounded-none border-0 bg-transparent'>
                          {detailSessions.map(
                            (s: ApiCheckpointSessionDetailDto, idx: number) => (
                              <TabsTrigger
                                key={`${s.session_id}-${s.session_index}`}
                                value={String(idx)}
                                variant='line'
                              >
                                Session {s.session_index + 1}
                              </TabsTrigger>
                            )
                          )}
                        </TabsList>
                        {detailSessions.map(
                          (session: ApiCheckpointSessionDetailDto, idx: number) => {
                            const transcriptEntries = parseTranscriptEntries(
                              session.transcript_jsonl
                            )
                            return (
                              <TabsContent
                                key={`${session.session_id}-${session.session_index}`}
                                value={String(idx)}
                                className='mt-0 space-y-3 px-6 pt-4 pb-6'
                              >
                                <div className='flex flex-wrap items-center gap-2'>
                                  <CardTitle className='text-sm'>
                                    Session {session.session_index + 1}
                                  </CardTitle>
                                  <CardDescription className='flex items-center gap-1 font-mono text-xs'>
                                    {session.session_id}
                                    <CopyButton value={session.session_id} />
                                  </CardDescription>
                                </div>
                                <div className='flex flex-wrap gap-2'>
                                  <Badge variant='secondary'>{formatAgentLabel(session.agent)}</Badge>
                                  <Badge variant='outline'>
                                    {formatDateTime(session.created_at)}
                                  </Badge>
                                </div>

                                <div className='space-y-1'>
                                  <p className='text-xs text-muted-foreground'>
                                    Prompt(s)
                                  </p>
                                  <pre className='max-h-40 overflow-auto rounded-md border bg-background p-2 text-xs whitespace-pre-wrap break-words'>
                                    {session.prompts_text
                                      ? stripUserQueryTags(session.prompts_text)
                                      : '-'}
                                  </pre>
                                </div>

                                <div className='space-y-1'>
                                  <p className='text-xs text-muted-foreground'>
                                    Context
                                  </p>
                                  <pre className='max-h-40 overflow-auto rounded-md border bg-background p-2 text-xs whitespace-pre-wrap break-words'>
                                    {session.context_text
                                      ? stripUserQueryTags(session.context_text)
                                      : '-'}
                                  </pre>
                                </div>

                                <div className='space-y-1'>
                                  <div className='flex items-center justify-between'>
                                    <p className='text-xs text-muted-foreground'>
                                      Metadata JSON
                                    </p>
                                    <CopyButton value={prettyPrintJson(session.metadata_json)} />
                                  </div>
                                  <div className='max-h-36 min-w-0 w-full overflow-auto rounded-md border bg-background p-2'>
                                    <SyntaxHighlighter
                                      language='json'
                                      style={codeBlockStyle}
                                      customStyle={{
                                        margin: 0,
                                        padding: 0,
                                        maxWidth: '100%',
                                        minWidth: 0,
                                        width: '100%',
                                        overflow: 'auto',
                                      }}
                                      showLineNumbers={false}
                                      PreTag='div'
                                      codeTagProps={{
                                        style: {
                                          fontSize: '11px',
                                          whiteSpace: 'pre-wrap',
                                          wordBreak: 'break-word',
                                        },
                                      }}
                                      wrapLongLines
                                    >
                                      {prettyPrintJson(session.metadata_json)}
                                    </SyntaxHighlighter>
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
                                      agentName={formatAgentLabel(session.agent)}
                                      userName={userName}
                                    />
                                  </div>
                                </div>
                              </TabsContent>
                            )
                          }
                        )}
                      </Tabs>
                    </Card>
                  )}
                </div>
              )}

              {viewMode === 'summary' && (
                <>
                  <div className='rounded-lg border bg-card p-3'>
                    <div className='grid grid-cols-2 gap-3 sm:grid-cols-4 sm:divide-x sm:divide-border sm:gap-0'>
                      <div className='sm:px-3 sm:first:ps-0 sm:last:pe-0'>
                        <p className='text-xs text-muted-foreground'>Files</p>
                        <p className='text-lg font-bold text-primary'>{detailFilesPaths.length}</p>
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
                    {detailFilesPaths.length > 0 ? (
                      <div className='rounded-md border bg-muted/20 p-3'>
                        <FileTree fileStats={detailFilesTouched} />
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
                    <div className='max-h-60 min-w-0 w-full overflow-auto rounded-md border bg-muted/20 p-3'>
                      <SyntaxHighlighter
                        language='json'
                        style={codeBlockStyle}
                        customStyle={{
                          margin: 0,
                          padding: 0,
                          maxWidth: '100%',
                          minWidth: 0,
                          width: '100%',
                          overflow: 'auto',
                        }}
                        showLineNumbers={false}
                        PreTag='div'
                        codeTagProps={{
                          style: {
                            fontSize: '11px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          },
                        }}
                        wrapLongLines
                      >
                        {metadataJson}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export function CheckpointSheet({
  selectedCheckpoint,
  checkpointDetail,
  checkpointDetailSource,
  userName,
  onClose,
}: CheckpointSheetProps) {
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
        <CheckpointDetailContent
          selectedCheckpoint={selectedCheckpoint}
          checkpointDetail={checkpointDetail}
          checkpointDetailSource={checkpointDetailSource}
          userName={userName}
        />
      </SheetContent>
    </Sheet>
  )
}
