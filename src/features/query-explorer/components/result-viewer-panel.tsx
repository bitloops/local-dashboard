import { useFont } from '@/context/font-provider'
import JsonViewer from '@andypf/json-viewer/dist/esm/react/JsonViewer'
import { getJsonViewerTheme } from '@/styles/json-viewer-theme'

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

export function ResultViewerPanel({
  result,
  theme = 'light',
  className,
}: ResultViewerPanelProps) {
  const { font } = useFont()
  const fontClass = `font-${font}`
  const viewerTheme = getJsonViewerTheme(theme)

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${className ?? ''}`.trim()}
      data-panel='results'
    >
      <div className='flex h-12 items-center border-b border-border px-3 py-2'>
        <h2 className='text-sm font-medium'>Results</h2>
      </div>
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden p-3 ${fontClass}`}
      >
        {result.status === 'idle' && (
          <p className='text-sm text-muted-foreground'>
            Run a query to see results.
          </p>
        )}
        {result.status === 'loading' && (
          <p className='text-sm text-muted-foreground'>Loading...</p>
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
          <div className={fontClass}>{result.error}</div>
        )}
      </div>
    </div>
  )
}
