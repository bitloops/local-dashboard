import { useStore } from '@/store'
import { runQueryExplorerQuery } from '../run-query'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

const MAX_PREVIEW_LEN = 60

function truncateQuery(q: string): string {
  const oneLine = q.replace(/\s+/g, ' ').trim()
  return oneLine.length <= MAX_PREVIEW_LEN
    ? oneLine
    : oneLine.slice(0, MAX_PREVIEW_LEN) + '…'
}

type HistoryPanelProps = {
  onLoadEntry?: () => void
  className?: string
}

export function HistoryPanel({
  onLoadEntry,
  className,
}: HistoryPanelProps = {}) {
  const runHistory = useStore((s) => s.runHistory)
  const loadHistoryEntry = useStore((s) => s.loadHistoryEntry)
  const removeHistoryEntry = useStore((s) => s.removeHistoryEntry)

  const handleLoad = (id: string) => {
    loadHistoryEntry(id)
    onLoadEntry?.()
  }

  if (runHistory.length === 0) {
    return (
      <div className={cn('px-3 py-4', className)}>
        <p className='text-xs text-muted-foreground'>
          Run a query to see history here.
        </p>
      </div>
    )
  }

  return (
    <ul
      className={cn('flex flex-col gap-2 overflow-auto px-3 py-2', className)}
    >
      {runHistory.map((entry) => (
        <li
          key={entry.id}
          className='flex flex-col gap-1 border border-border bg-muted/30 px-2 py-1.5 text-xs'
        >
          <p
            className='truncate font-mono text-muted-foreground'
            title={entry.query}
          >
            {truncateQuery(entry.query)}
          </p>
          <p className='text-muted-foreground'>
            {formatDistanceToNow(entry.runAt, { addSuffix: true })}
          </p>
          <div className='flex gap-1'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='h-7 text-xs'
              onClick={() => handleLoad(entry.id)}
            >
              Load
            </Button>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              className='h-7 text-xs'
              onClick={() =>
                runQueryExplorerQuery({
                  query: entry.query,
                  variables: entry.variables,
                })
              }
            >
              Re-run
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='h-7 text-xs text-muted-foreground hover:text-destructive'
              onClick={() => removeHistoryEntry(entry.id)}
              aria-label='Remove from history'
            >
              Remove
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
