import { cn } from '@/lib/utils'

type QueryExplorerLayoutProps = {
  editorPanelWidth: number
  onResizeStart: (e: React.PointerEvent) => void
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  /** Omitted on Sessions (editor + variables only, side by side). */
  bottomPanel?: React.ReactNode
  className?: string
  /** Override default bottom strip height (e.g. Sessions adds repo/branch dropdowns). */
  bottomPanelClassName?: string
}

export function QueryExplorerLayout({
  editorPanelWidth,
  onResizeStart,
  leftPanel,
  rightPanel,
  bottomPanel,
  className,
  bottomPanelClassName,
}: QueryExplorerLayoutProps) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden border border-foreground/20 bg-card text-card-foreground',
        className,
      )}
      data-layout='query-explorer'
    >
      <div className='flex min-h-0 flex-1'>
        <div
          className='flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden'
          style={{ width: editorPanelWidth }}
        >
          {leftPanel}
        </div>
        <div
          role='separator'
          aria-orientation='vertical'
          aria-label='Resize editor and side panel'
          onPointerDown={onResizeStart}
          className='w-px shrink-0 cursor-col-resize border-e border-foreground/20 bg-transparent transition-colors hover:bg-foreground/10'
        />
        <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
          {rightPanel}
        </div>
      </div>
      {bottomPanel != null ? (
        <div
          className={cn(
            'h-[180px] min-h-[140px] shrink-0 border-t border-foreground/20',
            bottomPanelClassName,
          )}
        >
          {bottomPanel}
        </div>
      ) : null}
    </div>
  )
}
