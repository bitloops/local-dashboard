import { cn } from '@/lib/utils'

export type ResultViewerState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: unknown }
  | { status: 'error'; error: string }

type ResultViewerPanelProps = {
  result: ResultViewerState
  className?: string
}

export function ResultViewerPanel({
  result,
  className,
}: ResultViewerPanelProps) {
  return (
    <div
      className={cn('flex min-h-0 flex-col', className)}
      data-panel='results'
    >
      <div className='border-b border-border px-3 py-2'>
        <h2 className='text-sm font-medium'>Results</h2>
      </div>
      <div className='flex min-h-0 flex-1 flex-col overflow-auto p-3'>
        {result.status === 'idle' && (
          <p className='text-sm text-muted-foreground'>
            Run a query to see results.
          </p>
        )}
        {result.status === 'loading' && (
          <p className='text-sm text-muted-foreground'>Loading...</p>
        )}
        {result.status === 'success' && (
          <pre className='overflow-auto border border-border bg-muted/20 p-3 text-xs text-foreground'>
            {JSON.stringify(result.data, null, 2)}
          </pre>
        )}
        {result.status === 'error' && (
          <p className='text-sm text-destructive'>{result.error}</p>
        )}
      </div>
    </div>
  )
}
