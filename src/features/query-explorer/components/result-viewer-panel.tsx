import { useFont } from '@/context/font-provider'
import { AlertCircle, Loader2 } from 'lucide-react'
import JsonViewer from '@andypf/json-viewer/dist/esm/react/JsonViewer'
import { getJsonViewerTheme } from '@/styles/json-viewer-theme'
import { cn } from '@/lib/utils'

export type ResultViewerState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: unknown; errors?: string[] }
  | { status: 'error'; error: string }

type ResultViewerPanelProps = {
  result: ResultViewerState
  theme?: 'light' | 'dark'
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
  theme = 'light',
  className,
}: ResultViewerPanelProps) {
  const { font } = useFont()
  const fontClass = `font-${font}`
  const viewerTheme = getJsonViewerTheme(theme)
  const hasError =
    result.status === 'error' ||
    (result.status === 'success' && (result.errors?.length ?? 0) > 0)

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${className ?? ''}`.trim()}
      data-panel='results'
    >
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
        {result.status === 'success' && (
          <div
            className={`${treeContainerClass} ${fontClass} result-viewer-json-tree`}
            data-testid='result-viewer-json-tree'
          >
            <div className='min-h-0 flex-1 overflow-auto'>
              <JsonViewer
                data={
                  result.errors?.length
                    ? {
                        data: result.data ?? null,
                        errors: result.errors,
                      }
                    : (result.data ?? {})
                }
                theme={viewerTheme}
                expanded={4}
                showDataTypes
                showToolbar={false}
                showCopy
                showSize={false}
                expandIconType='square'
                indent={2}
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
