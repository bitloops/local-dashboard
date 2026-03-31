import { useStore } from '@/store'
import type { HistoryStorageMode } from '@/store'
import { runQueryExplorerQuery } from '../run-query'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  const historyStorageMode = useStore((s) => s.historyStorageMode)
  const setHistoryStorageMode = useStore((s) => s.setHistoryStorageMode)

  const handleLoad = (id: string) => {
    loadHistoryEntry(id)
    onLoadEntry?.()
  }

  const storageFooter = (
    <div className='shrink-0 space-y-1.5 border-t border-border px-3 py-2'>
      <Label
        htmlFor='history-storage-mode'
        className='text-xs text-muted-foreground'
      >
        Save history
      </Label>
      <Select
        value={historyStorageMode}
        onValueChange={(value) =>
          setHistoryStorageMode(value as HistoryStorageMode)
        }
      >
        <SelectTrigger
          id='history-storage-mode'
          size='sm'
          className='h-8 w-full max-w-full text-xs'
          aria-label='Where to save query history'
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='local'>This browser (until expired)</SelectItem>
          <SelectItem value='session'>This tab only</SelectItem>
          <SelectItem value='off'>Do not save</SelectItem>
        </SelectContent>
      </Select>
      <p className='text-[11px] leading-snug text-muted-foreground'>
        {historyStorageMode === 'off'
          ? 'History is not retained after each run.'
          : historyStorageMode === 'session'
            ? 'History clears when you close this tab.'
            : 'History is stored locally and pruned after the configured retention period.'}
      </p>
    </div>
  )

  if (runHistory.length === 0) {
    return (
      <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
        <div className='flex flex-1 px-3 py-4'>
          <p className='text-xs text-muted-foreground'>
            Run a query to see history here.
          </p>
        </div>
        {storageFooter}
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <ul className='flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-3 py-2'>
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
      {storageFooter}
    </div>
  )
}
