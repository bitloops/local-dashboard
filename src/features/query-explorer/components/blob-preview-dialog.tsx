'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GitBlobFetchError, fetchGitBlob } from '../fetch-git-blob'
import { cn } from '@/lib/utils'

type BlobPreviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  repo: string | null
  blobSha: string | null
}

export function BlobPreviewDialog({
  open,
  onOpenChange,
  repo,
  blobSha,
}: BlobPreviewDialogProps) {
  const [result, setResult] = useState<{
    requestKey: string
    phase: 'success' | 'error'
    text: string
    errorMessage: string
  } | null>(null)
  const requestKey = open && repo && blobSha ? `${repo}:${blobSha}` : null

  useEffect(() => {
    if (!requestKey || !repo || !blobSha) {
      return
    }

    const controller = new AbortController()

    fetchGitBlob({ repo, blobSha, signal: controller.signal })
      .then((buffer) => {
        const decoder = new TextDecoder('utf-8', { fatal: false })
        setResult({
          requestKey,
          phase: 'success',
          text: decoder.decode(buffer),
          errorMessage: '',
        })
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        const message =
          err instanceof GitBlobFetchError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to load blob.'
        setResult({
          requestKey,
          phase: 'error',
          text: '',
          errorMessage: message,
        })
      })

    return () => controller.abort()
  }, [blobSha, repo, requestKey])

  const phase: 'idle' | 'loading' | 'success' | 'error' =
    requestKey === null
      ? 'idle'
      : result?.requestKey === requestKey
        ? result.phase
        : 'loading'
  const text =
    requestKey !== null && result?.requestKey === requestKey ? result.text : ''
  const errorMessage =
    requestKey !== null && result?.requestKey === requestKey
      ? result.errorMessage
      : ''

  // Git OIDs are 40 or 64 hex chars; ellipsis keeps the dialog title readable.
  const shortSha = blobSha ? `${blobSha.slice(0, 7)}…${blobSha.slice(-6)}` : ''

  const blobContentMinClass = 'min-h-[min(60vh,520px)]'
  const showBlobBody =
    Boolean(repo) &&
    (phase === 'loading' || phase === 'success' || phase === 'error')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[min(85vh,720px)] max-w-[calc(100%-2rem)] flex-col gap-3 sm:max-w-3xl',
        )}
        showCloseButton
      >
        <DialogHeader className='shrink-0 text-start'>
          <DialogTitle>Blob preview</DialogTitle>
          <DialogDescription className='font-mono text-xs break-all'>
            {blobSha ? shortSha : ''}
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-muted/30',
            showBlobBody && cn('flex flex-col', blobContentMinClass),
          )}
        >
          {!repo && open && (
            <p className='p-3 text-sm text-muted-foreground'>
              Set a non-empty <code className='text-foreground'>repo</code> in
              query variables to fetch blob content.
            </p>
          )}
          {repo && phase === 'loading' && (
            <div
              role='status'
              className='flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-muted-foreground'
            >
              <Loader2 className='size-10 shrink-0 animate-spin' aria-hidden />
              <span className='sr-only'>Loading blob content</span>
              <span className='text-sm' aria-hidden>
                Loading…
              </span>
            </div>
          )}
          {repo && phase === 'error' && (
            <div className='flex min-h-0 flex-1 items-start gap-2 overflow-auto p-3 text-sm text-destructive'>
              <AlertCircle className='size-4 shrink-0 mt-0.5' aria-hidden />
              <span className='min-w-0 break-words'>{errorMessage}</span>
            </div>
          )}
          {repo && phase === 'success' && (
            <pre
              className='min-h-0 flex-1 overflow-auto p-3 text-xs leading-relaxed whitespace-pre-wrap break-words font-mono text-foreground max-h-[min(60vh,520px)]'
              tabIndex={0}
            >
              {text.length === 0 ? (
                <span className='text-muted-foreground'>(empty file)</span>
              ) : (
                text
              )}
            </pre>
          )}
        </div>
        {repo && phase === 'success' && (
          <p className='text-xs text-muted-foreground'>
            Shown as UTF-8 (invalid sequences replaced).
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
