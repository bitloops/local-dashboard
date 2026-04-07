import { useFont } from '@/context/font-provider'
import { useCallback, useMemo, useState } from 'react'
import { AlertCircle, Info, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { payloadHasPreviewableBlobSha } from '../payload-has-previewable-blob-sha'
import { parseQueryExplorerRepo } from '../parse-query-explorer-repo'
import type { QueryExplorerResolvedTheme } from '../types'
import { BlobPreviewDialog } from './blob-preview-dialog'
import { QueryResultReactJson } from './query-result-react-json'

export type ResultViewerState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: unknown; errors?: string[] }
  | { status: 'error'; error: string }

type ResultViewerPanelProps = {
  result: ResultViewerState
  /** Raw variables JSON (same document as the Variables panel) for `repo` lookup. */
  variables?: string
  theme?: QueryExplorerResolvedTheme
  className?: string
}

const treeContainerClass =
  'flex min-h-0 flex-1 flex-col overflow-hidden border border-border text-xs text-foreground'

const contentAreaClass =
  'flex min-h-0 flex-1 flex-col overflow-hidden p-3 rounded-b-md'

const errorContentAreaClass =
  'bg-destructive/10 flex min-h-0 flex-1 flex-col overflow-hidden p-3'

export function ResultViewerPanel({
  result,
  variables = '{}',
  theme = 'light',
  className,
}: ResultViewerPanelProps) {
  const { font } = useFont()
  const fontClass = `font-${font}`
  const hasError =
    result.status === 'error' ||
    (result.status === 'success' && (result.errors?.length ?? 0) > 0)

  const repoForBlobs = useMemo(
    () => parseQueryExplorerRepo(variables),
    [variables],
  )

  const [blobModalOpen, setBlobModalOpen] = useState(false)
  const [previewSha, setPreviewSha] = useState<string | null>(null)

  const openBlob = useCallback((sha: string) => {
    setPreviewSha(sha)
    setBlobModalOpen(true)
  }, [])

  const viewerPayload = useMemo((): unknown | null => {
    if (result.status !== 'success') return null
    return result.errors?.length
      ? { data: result.data ?? null, errors: result.errors }
      : (result.data ?? {})
  }, [result])

  const showBlobPreviewHint = useMemo(
    () => viewerPayload !== null && payloadHasPreviewableBlobSha(viewerPayload),
    [viewerPayload],
  )

  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col', className)}
      data-panel='results'
    >
      <BlobPreviewDialog
        open={blobModalOpen}
        onOpenChange={(open) => {
          setBlobModalOpen(open)
          if (!open) setPreviewSha(null)
        }}
        repo={repoForBlobs}
        blobSha={previewSha}
      />
      <div className='flex h-12 items-center border-b border-border px-3 py-2'>
        <h2 className='text-sm font-medium'>Results</h2>
      </div>
      <div
        className={cn(
          fontClass,
          hasError ? errorContentAreaClass : contentAreaClass,
        )}
        data-error={hasError ? true : undefined}
      >
        {result.status === 'idle' && (
          <p className='text-sm text-muted-foreground'>
            Run a query to see results.
          </p>
        )}
        {result.status === 'loading' && (
          <div className='flex min-h-0 flex-1 items-center justify-center'>
            <Loader2
              className='size-6 shrink-0 animate-spin text-muted-foreground'
              aria-hidden
            />
          </div>
        )}
        {result.status === 'success' && viewerPayload !== null && (
          <div
            className={cn(treeContainerClass, 'result-viewer-json-tree')}
            data-testid='result-viewer-json-tree'
          >
            {showBlobPreviewHint && (
              <div
                className='flex shrink-0 items-start gap-2 border-b border-border px-3 py-2'
                data-testid='result-blob-preview-hint'
              >
                <Info
                  className='size-3.5 shrink-0 text-muted-foreground mt-0.5'
                  aria-hidden
                />
                <p className='min-w-0 text-xs text-muted-foreground leading-snug'>
                  {repoForBlobs ? (
                    <>
                      <code className='rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]'>
                        blobSha
                      </code>{' '}
                      values are clickable to preview the blob.
                    </>
                  ) : (
                    <>
                      Set{' '}
                      <code className='rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]'>
                        repo
                      </code>{' '}
                      in Variables to preview blobs, then click a{' '}
                      <code className='rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]'>
                        blobSha
                      </code>{' '}
                      value.
                    </>
                  )}
                </p>
              </div>
            )}
            <div className='min-h-0 flex-1 overflow-auto p-3'>
              <QueryResultReactJson
                data={viewerPayload}
                repoForBlobs={repoForBlobs}
                onOpenBlob={openBlob}
                theme={theme}
              />
            </div>
          </div>
        )}
        {result.status === 'error' && (
          <div className='flex items-start gap-2 break-words text-sm text-destructive'>
            <AlertCircle className='size-4 shrink-0 mt-0.5' aria-hidden />
            <span>{result.error}</span>
          </div>
        )}
      </div>
    </div>
  )
}
