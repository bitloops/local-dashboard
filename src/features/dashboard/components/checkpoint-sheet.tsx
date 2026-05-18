import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  type DashboardCheckpointDetailResponse,
  type DashboardCheckpointSessionDetailDto,
  type DashboardInteractionSessionDetailResponse,
  type DashboardInteractionTurnDto,
} from '../api-types'
import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { XIcon } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import { ChatTranscript } from './chat-transcript'
import { codeBlockStyle } from './code-block-style'
import { FileTree } from './file-tree'
import { type Checkpoint } from '../types'
import { type CheckpointDetailLoadState } from '../types'
import { formatAgentLabel, formatModelLabel } from '../utils'
import { fetchDashboardInteractionSessionDetail } from '../graphql/fetch-dashboard-data'
import {
  formatDateTime,
  formatPromptForDisplay,
  prettyPrintJson,
} from './checkpoint-sheet-utils'
import { SessionToolUseList } from '@/features/dashboard/components/session-tool-use-list'
import { sortedSessionToolUses } from '@/features/dashboard/utils/session-tool-uses'
import { TurnsTimeline } from '@/features/dashboard/components/turns-timeline'
import { buildSessionTranscriptAnalysis } from '@/features/dashboard/utils/turn-transcript'
import { transcriptEntriesToMessages } from '@/features/dashboard/utils/transcript-entries'

SyntaxHighlighter.registerLanguage('json', json)

const TokenUsageChart = lazy(() =>
  import('./token-usage-chart').then((m) => ({ default: m.TokenUsageChart })),
)

export type CheckpointDetailContentProps = {
  selectedCheckpoint: Checkpoint | null
  checkpointDetail: DashboardCheckpointDetailResponse | null
  checkpointDetailSource: CheckpointDetailLoadState
  userName: string
  repoId: string | null
  /** When provided, a close button is shown in the header (e.g. when used inside Sidebar). */
  onClose?: () => void
}

type CheckpointSheetProps = CheckpointDetailContentProps & {
  onClose: () => void
}

type SheetViewMode = 'session' | 'summary'
type SessionSubView = 'detail' | 'turns' | 'tools'

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

/** Inner content for checkpoint detail. Use inside Sheet (CheckpointSheet) or Sidebar. */
export function CheckpointDetailContent(props: CheckpointDetailContentProps) {
  return <CheckpointDetailContentInner {...props} />
}

function CheckpointDetailContentInner({
  selectedCheckpoint,
  checkpointDetail,
  checkpointDetailSource,
  userName,
  repoId,
  onClose,
}: CheckpointDetailContentProps) {
  const [viewMode, setViewMode] = useState<SheetViewMode>('session')
  const [sessionSubView, setSessionSubView] = useState<SessionSubView>('detail')
  const [selectedSessionTab, setSelectedSessionTab] = useState('0')
  const [interactionDetail, setInteractionDetail] =
    useState<DashboardInteractionSessionDetailResponse | null>(null)
  const [interactionSource, setInteractionSource] = useState<
    'idle' | 'loading' | 'api' | 'error'
  >('idle')
  const [interactionError, setInteractionError] = useState<string | null>(null)
  const interactionAbortRef = useRef<AbortController | null>(null)

  const selectedCheckpointCreatedAt = selectedCheckpoint?.createdAt
    ? formatDateTime(selectedCheckpoint.createdAt)
    : null

  const detailFilesTouched =
    checkpointDetail?.files_touched ?? selectedCheckpoint?.filesTouched ?? []
  const detailFilesPaths = detailFilesTouched.map((file) => file.filepath)
  const detailSessionCount =
    checkpointDetail?.session_count ?? selectedCheckpoint?.sessionCount ?? 0
  const detailCheckpointsCount =
    checkpointDetail?.checkpoints_count ??
    selectedCheckpoint?.checkpointsCount ??
    0
  const detailStrategy =
    checkpointDetail?.strategy ?? selectedCheckpoint?.strategy ?? '-'
  const detailBranch =
    checkpointDetail?.branch ?? selectedCheckpoint?.branch ?? '-'
  const detailTokenUsage = checkpointDetail?.token_usage
  const detailSessions = checkpointDetail?.sessions ?? []

  const activeCheckpointSession =
    detailSessions[Number(selectedSessionTab)] ?? null

  useEffect(() => {
    return () => {
      interactionAbortRef.current?.abort()
      interactionAbortRef.current = null
    }
  }, [])

  async function ensureInteractionDetailLoaded(sessionId: string) {
    if (
      interactionDetail?.summary.session_id === sessionId &&
      interactionSource === 'api'
    ) {
      return
    }

    const controller = new AbortController()
    interactionAbortRef.current?.abort()
    interactionAbortRef.current = controller

    setInteractionSource('loading')
    setInteractionError(null)
    try {
      const result = await fetchDashboardInteractionSessionDetail(
        {
          repoId,
          sessionId,
        },
        {
          signal: controller.signal,
        },
      )
      if (controller.signal.aborted) {
        return
      }
      setInteractionDetail(result)
      setInteractionSource('api')
    } catch (err) {
      if (isAbortError(err) || controller.signal.aborted) {
        return
      }
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load interaction session.'
      setInteractionDetail(null)
      setInteractionSource('error')
      setInteractionError(message)
    } finally {
      if (interactionAbortRef.current === controller) {
        interactionAbortRef.current = null
      }
    }
  }

  const openInteractionForActiveSession = () => {
    const sessionId = activeCheckpointSession?.session_id?.trim()
    if (!sessionId) {
      setInteractionDetail(null)
      setInteractionSource('error')
      setInteractionError('No sessionId available for this checkpoint session.')
      return
    }
    void ensureInteractionDetailLoaded(sessionId)
  }

  const showInteractionFetchBanner =
    (sessionSubView === 'turns' || sessionSubView === 'tools') &&
    interactionSource === 'error'

  const turns: DashboardInteractionTurnDto[] = interactionDetail?.turns ?? []
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
  const sessionToolUsesList = sortedSessionToolUses(
    interactionDetail?.summary ?? null,
  )
  const activeTranscriptEntries = useMemo(() => {
    if (
      viewMode !== 'session' ||
      sessionSubView !== 'detail' ||
      activeCheckpointSession == null
    ) {
      return []
    }

    return transcriptEntriesToMessages(
      activeCheckpointSession.transcript_entries ?? [],
    )
  }, [activeCheckpointSession, sessionSubView, viewMode])

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
        2,
      )
    : ''

  return (
    <>
      <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
        <div className='flex min-w-0 items-center justify-between gap-2 border-b px-4 py-4 pr-14 text-start'>
          <h2 className='flex items-center gap-1 text-lg font-semibold'>
            {selectedCheckpoint
              ? `Checkpoint ${selectedCheckpoint.id}`
              : 'Checkpoint'}
            {selectedCheckpoint && <CopyButton value={selectedCheckpoint.id} />}
          </h2>
          {onClose && (
            <Button
              variant='ghost'
              size='icon'
              onClick={onClose}
              aria-label='Close checkpoint panel'
            >
              <XIcon className='size-4' />
            </Button>
          )}
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto overflow-x-hidden'>
          <div className='w-full min-w-0 space-y-5 p-4'>
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
                  className='flex min-w-0 w-full rounded-lg border border-border bg-muted/40 p-0.5'
                  role='tablist'
                  aria-label='View mode'
                >
                  <button
                    type='button'
                    role='tab'
                    aria-selected={viewMode === 'session'}
                    onClick={() => setViewMode('session')}
                    className={cn(
                      'min-w-0 flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      viewMode === 'session'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
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
                      'min-w-0 flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      viewMode === 'summary'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Details
                  </button>
                </div>

                {viewMode === 'session' && (
                  <div>
                    <h3 className='mb-2 text-sm font-semibold'>
                      Chat Sessions
                    </h3>
                    {checkpointDetailSource === 'loading' && (
                      <p className='text-sm text-muted-foreground'>
                        Loading chat data for this checkpoint…
                      </p>
                    )}
                    {checkpointDetailSource === 'error' && (
                      <p className='text-sm text-muted-foreground'>
                        Could not load chat data from `/devql/dashboard` for
                        checkpoint {` ${selectedCheckpoint.id}`}.
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
                      <Card className='min-w-0 overflow-hidden bg-muted/20 pt-0'>
                        <Tabs
                          key={selectedCheckpoint.id}
                          value={selectedSessionTab}
                          onValueChange={(value) => {
                            interactionAbortRef.current?.abort()
                            interactionAbortRef.current = null
                            setSelectedSessionTab(value)
                            setSessionSubView('detail')
                            setInteractionDetail(null)
                            setInteractionSource('idle')
                            setInteractionError(null)
                          }}
                          className='min-w-0'
                        >
                          <div className='w-full min-w-0 overflow-x-auto border-b'>
                            <TabsList
                              variant='line'
                              className='h-auto min-w-max justify-start rounded-none border-0 bg-transparent'
                            >
                              {detailSessions.map(
                                (
                                  s: DashboardCheckpointSessionDetailDto,
                                  idx: number,
                                ) => (
                                  <TabsTrigger
                                    key={`${s.session_id}-${s.session_index}`}
                                    value={String(idx)}
                                    variant='line'
                                  >
                                    Session {s.session_index + 1}
                                  </TabsTrigger>
                                ),
                              )}
                            </TabsList>
                          </div>
                          {activeCheckpointSession && (
                            <TabsContent
                              key={`${activeCheckpointSession.session_id}-${activeCheckpointSession.session_index}`}
                              value={selectedSessionTab}
                              className='mt-0 min-w-0 space-y-3 px-4 pt-4 pb-6 sm:px-6'
                            >
                              <div
                                className='flex min-w-0 w-full rounded-lg border border-border bg-muted/40 p-0.5'
                                role='tablist'
                                aria-label='Session view'
                              >
                                {(
                                  [
                                    {
                                      key: 'detail',
                                      label: 'Session detail',
                                    },
                                    { key: 'turns', label: 'Turns' },
                                    { key: 'tools', label: 'Tool use' },
                                  ] as const
                                ).map((item) => (
                                  <button
                                    key={item.key}
                                    type='button'
                                    role='tab'
                                    aria-selected={sessionSubView === item.key}
                                    onClick={() => {
                                      setSessionSubView(item.key)
                                      if (item.key === 'detail') {
                                        if (interactionSource === 'loading') {
                                          interactionAbortRef.current?.abort()
                                          interactionAbortRef.current = null
                                          setInteractionSource(
                                            interactionDetail ? 'api' : 'idle',
                                          )
                                        }
                                        return
                                      }
                                      void openInteractionForActiveSession()
                                    }}
                                    className={cn(
                                      'min-w-0 flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                      sessionSubView === item.key
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground',
                                    )}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>

                              {showInteractionFetchBanner && (
                                <p className='text-sm text-muted-foreground'>
                                  Could not load interaction data for this
                                  session.
                                  {interactionError
                                    ? ` ${interactionError}`
                                    : ''}
                                </p>
                              )}

                              {sessionSubView === 'turns' && (
                                <div className='space-y-2'>
                                  {interactionSource === 'loading' && (
                                    <p className='text-sm text-muted-foreground'>
                                      Loading turns…
                                    </p>
                                  )}
                                  {interactionSource === 'api' &&
                                    turns.length === 0 && (
                                      <p className='text-sm text-muted-foreground'>
                                        No turns were returned for this session.
                                      </p>
                                    )}
                                  {interactionSource === 'api' &&
                                    turns.length > 0 && (
                                      <TurnsTimeline
                                        turns={turns}
                                        userName={userName}
                                        sections={transcriptAnalysis?.sections}
                                      />
                                    )}
                                </div>
                              )}

                              {sessionSubView === 'tools' && (
                                <div className='space-y-2'>
                                  {interactionSource === 'loading' && (
                                    <p className='text-sm text-muted-foreground'>
                                      Loading tool use…
                                    </p>
                                  )}
                                  {interactionSource === 'api' && (
                                    <SessionToolUseList
                                      tools={sessionToolUsesList}
                                      transcriptEntries={
                                        transcriptAnalysis?.sessionEntries ?? []
                                      }
                                      emptyMessage='No tool use entries were returned for this session.'
                                    />
                                  )}
                                </div>
                              )}

                              {sessionSubView === 'detail' && (
                                <div className='space-y-3'>
                                  <div className='min-w-0 flex flex-wrap items-center gap-2'>
                                    <CardTitle className='text-sm'>
                                      Session{' '}
                                      {activeCheckpointSession.session_index +
                                        1}
                                    </CardTitle>
                                    <CardDescription className='min-w-0 flex items-center gap-1 font-mono text-xs'>
                                      <span className='min-w-0 break-all'>
                                        {activeCheckpointSession.session_id}
                                      </span>
                                      <CopyButton
                                        value={
                                          activeCheckpointSession.session_id
                                        }
                                      />
                                    </CardDescription>
                                  </div>
                                  <div className='flex flex-wrap gap-2'>
                                    <Badge variant='secondary'>
                                      {formatAgentLabel(
                                        activeCheckpointSession.agent,
                                      )}
                                    </Badge>
                                    <Badge variant='outline'>
                                      {formatDateTime(
                                        activeCheckpointSession.created_at,
                                      )}
                                    </Badge>
                                  </div>

                                  <div className='space-y-1'>
                                    <p className='text-xs text-muted-foreground'>
                                      Prompt(s)
                                    </p>
                                    <pre className='max-h-40 overflow-auto rounded-md border bg-background p-2 text-xs whitespace-pre-wrap break-words'>
                                      {activeCheckpointSession.prompts_text
                                        ? formatPromptForDisplay(
                                            activeCheckpointSession.prompts_text,
                                          ) || '-'
                                        : '-'}
                                    </pre>
                                  </div>

                                  <div className='space-y-1'>
                                    <p className='text-xs text-muted-foreground'>
                                      Context
                                    </p>
                                    <pre className='max-h-40 overflow-auto rounded-md border bg-background p-2 text-xs whitespace-pre-wrap break-words'>
                                      {activeCheckpointSession.context_text
                                        ? formatPromptForDisplay(
                                            activeCheckpointSession.context_text,
                                          ) || '-'
                                        : '-'}
                                    </pre>
                                  </div>

                                  <div className='space-y-1'>
                                    <div className='flex items-center justify-between'>
                                      <p className='text-xs text-muted-foreground'>
                                        Metadata JSON
                                      </p>
                                      <CopyButton
                                        value={prettyPrintJson(
                                          activeCheckpointSession.metadata_json,
                                        )}
                                      />
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
                                        {prettyPrintJson(
                                          activeCheckpointSession.metadata_json,
                                        )}
                                      </SyntaxHighlighter>
                                    </div>
                                  </div>

                                  <div className='space-y-1'>
                                    <p className='text-xs text-muted-foreground'>
                                      Transcript
                                    </p>
                                    <div className='max-h-72 min-w-0 overflow-auto rounded-md border bg-background p-2'>
                                      <ChatTranscript
                                        entries={activeTranscriptEntries}
                                        sessionId={
                                          activeCheckpointSession.session_id
                                        }
                                        agentName={formatAgentLabel(
                                          activeCheckpointSession.agent,
                                        )}
                                        userName={userName}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </TabsContent>
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
                          <p className='text-lg font-bold text-primary'>
                            {detailFilesPaths.length}
                          </p>
                        </div>
                        <div className='sm:px-3 sm:first:ps-0 sm:last:pe-0'>
                          <p className='text-xs text-muted-foreground'>
                            Sessions
                          </p>
                          <p className='text-lg font-bold text-primary'>
                            {detailSessionCount}
                          </p>
                        </div>
                        <div className='sm:px-3 sm:first:ps-0 sm:last:pe-0'>
                          <p className='text-xs text-muted-foreground'>
                            Tokens
                          </p>
                          <p className='text-lg font-bold text-primary'>
                            {detailTokenUsage
                              ? `${Math.round((detailTokenUsage.input_tokens + detailTokenUsage.output_tokens + detailTokenUsage.cache_read_tokens + detailTokenUsage.cache_creation_tokens) / 1000)}K`
                              : '-'}
                          </p>
                        </div>
                        <div className='sm:px-3 sm:first:ps-0 sm:last:pe-0'>
                          <p className='text-xs text-muted-foreground'>
                            API calls
                          </p>
                          <p className='text-lg font-bold text-primary'>
                            {detailTokenUsage
                              ? detailTokenUsage.api_call_count
                              : '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {selectedCheckpoint.commitMessage && (
                      <>
                        <Separator />
                        <div>
                          <h3 className='mb-2 text-sm font-semibold'>
                            Commit Message
                          </h3>
                          <p className='rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words'>
                            {selectedCheckpoint.commitMessage}
                          </p>
                        </div>
                      </>
                    )}

                    <Separator />

                    <div>
                      <h3 className='mb-2 text-sm font-semibold'>
                        Files Touched
                      </h3>
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
                      <h3 className='mb-2 text-sm font-semibold'>
                        Token Usage
                      </h3>
                      {detailTokenUsage ? (
                        <Suspense
                          fallback={
                            <div className='h-40 animate-pulse rounded-md bg-muted/30' />
                          }
                        >
                          <TokenUsageChart usage={detailTokenUsage} />
                        </Suspense>
                      ) : (
                        <p className='text-sm text-muted-foreground'>
                          No token usage data for this checkpoint.
                        </p>
                      )}
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
        </div>
      </div>
    </>
  )
}

/** Turn detail body (prompt, transcript, token chart, files) — use inside sheet/sidebar accordions. */
export function TurnDetailContent({
  turn,
  userName,
}: {
  turn: DashboardInteractionTurnDto
  userName: string
}) {
  const transcriptEntries = transcriptEntriesToMessages(
    turn.transcript_entries ?? [],
  )

  return (
    <div className='space-y-4'>
      <span className='sr-only'>Turn {turn.turn_number}</span>
      <div className='flex flex-wrap items-center gap-2 border-b border-border pb-3'>
        <CopyButton value={turn.turn_id} />
        <Badge variant='secondary'>{turn.agent_type}</Badge>
        {turn.model && (
          <Badge variant='outline'>{formatModelLabel(turn.model)}</Badge>
        )}
        {turn.started_at && (
          <Badge variant='outline'>{formatDateTime(turn.started_at)}</Badge>
        )}
        {turn.ended_at && (
          <Badge variant='outline'>ended {formatDateTime(turn.ended_at)}</Badge>
        )}
        {turn.checkpoint_id && <Badge variant='secondary'>checkpoint</Badge>}
      </div>

      <div className='space-y-1'>
        <p className='text-xs text-muted-foreground'>Prompt</p>
        <p className='rounded-md border bg-muted/20 p-3 text-sm whitespace-pre-wrap break-words'>
          {formatPromptForDisplay(turn.prompt) || '-'}
        </p>
      </div>

      <div className='space-y-1'>
        <p className='text-xs text-muted-foreground'>Transcript (turn)</p>
        <div className='max-h-[min(50vh,320px)] overflow-auto rounded-md border bg-background p-2'>
          {transcriptEntries.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              No transcript fragment available for this turn.
            </p>
          ) : (
            <ChatTranscript
              entries={transcriptEntries}
              sessionId={turn.session_id}
              agentName={formatAgentLabel(turn.agent_type)}
              userName={userName}
            />
          )}
        </div>
      </div>

      <Separator />
      <div>
        <h3 className='mb-2 text-sm font-semibold'>Token Usage</h3>
        <Suspense
          fallback={
            <div className='h-40 animate-pulse rounded-md bg-muted/30' />
          }
        >
          <TokenUsageChart usage={turn.token_usage} />
        </Suspense>
      </div>

      <div>
        <h3 className='mb-2 text-sm font-semibold'>Files Touched</h3>
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

export function CheckpointSheet({
  selectedCheckpoint,
  checkpointDetail,
  checkpointDetailSource,
  userName,
  repoId,
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
      <SheetContent
        side='right'
        className='w-full max-w-[min(100vw,700px)] overflow-hidden p-0'
        resizable
        defaultWidth={600}
        maxWidth={700}
      >
        <CheckpointDetailContent
          selectedCheckpoint={selectedCheckpoint}
          checkpointDetail={checkpointDetail}
          checkpointDetailSource={checkpointDetailSource}
          userName={userName}
          repoId={repoId}
        />
      </SheetContent>
    </Sheet>
  )
}
