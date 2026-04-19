import { lazy, Suspense } from 'react'
import type { DashboardCheckpointDetailResponse } from '../api-types'
import { CopyButton } from '@/components/copy-button'
import { Separator } from '@/components/ui/separator'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import { FileTree } from './file-tree'
import { type Checkpoint } from '../types'
import { codeBlockStyle } from './code-block-style'

SyntaxHighlighter.registerLanguage('json', json)

const TokenUsageChart = lazy(() =>
  import('./token-usage-chart').then((m) => ({ default: m.TokenUsageChart })),
)

type CheckpointSummaryPanelProps = {
  selectedCheckpoint: Checkpoint
  checkpointDetail: DashboardCheckpointDetailResponse | null
}

/** Checkpoint-level summary only (stats, files, token chart, metadata) — no nested session tabs. */
export function CheckpointSummaryPanel({
  selectedCheckpoint,
  checkpointDetail,
}: CheckpointSummaryPanelProps) {
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

  const metadataJson = JSON.stringify(
    {
      strategy: detailStrategy,
      branch: detailBranch,
      session_id: selectedCheckpoint.sessionId ?? undefined,
      tool_use_id: selectedCheckpoint.toolUseId ?? undefined,
      commit: selectedCheckpoint.commit ?? undefined,
      sessions: detailSessionCount,
      checkpoints: detailCheckpointsCount,
    },
    null,
    2,
  )

  return (
    <div className='space-y-5'>
      <div className='rounded-lg border bg-card p-3'>
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-4 sm:divide-x sm:divide-border sm:gap-0'>
          <div className='sm:px-3 sm:first:ps-0 sm:last:pe-0'>
            <p className='text-xs text-muted-foreground'>Files</p>
            <p className='text-lg font-bold text-primary'>
              {detailFilesPaths.length}
            </p>
          </div>
          <div className='sm:px-3 sm:first:ps-0 sm:last:pe-0'>
            <p className='text-xs text-muted-foreground'>Sessions</p>
            <p className='text-lg font-bold text-primary'>
              {detailSessionCount}
            </p>
          </div>
          <div className='sm:px-3 sm:first:ps-0 sm:last:pe-0'>
            <p className='text-xs text-muted-foreground'>Tokens</p>
            <p className='text-lg font-bold text-primary'>
              {detailTokenUsage
                ? `${Math.round(
                    (detailTokenUsage.input_tokens +
                      detailTokenUsage.output_tokens +
                      detailTokenUsage.cache_read_tokens +
                      detailTokenUsage.cache_creation_tokens) /
                      1000,
                  )}K`
                : '-'}
            </p>
          </div>
          <div className='sm:px-3 sm:first:ps-0 sm:last:pe-0'>
            <p className='text-xs text-muted-foreground'>Tool calls</p>
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
            <p className='rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words'>
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
    </div>
  )
}
