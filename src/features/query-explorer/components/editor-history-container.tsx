import { useState } from 'react'
import { Code, History } from 'lucide-react'
import { QueryEditorPanel } from './editor-panel'
import { HistoryPanel } from './history-panel'
import { runQueryExplorerQuery } from '../run-query'
import { useStore } from '@/store'

type View = 'editor' | 'history'

/**
 * Left panel of the query explorer: toggles between the query editor and run history list.
 */
export function EditorHistoryContainer() {
  const [view, setView] = useState<View>('editor')
  const query = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  const result = useStore((s) => s.result)
  const variablesHaveErrors = useStore((s) => s.variablesHaveErrors)

  return (
    <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
      <div className='flex h-12 shrink-0 items-center justify-between border-b border-border px-3 py-2'>
        <div className='flex items-center gap-4'>
          <h2 className='min-w-16 text-sm font-medium'>
            {view === 'editor' ? 'Editor' : 'History'}
          </h2>
          <button
            type='button'
            onClick={() => setView(view === 'editor' ? 'history' : 'editor')}
            className='rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
            aria-label={view === 'editor' ? 'Show history' : 'Show editor'}
          >
            {view === 'editor' ? (
              <History className='size-4' aria-hidden />
            ) : (
              <Code className='size-4' aria-hidden />
            )}
          </button>
        </div>
        {view === 'editor' && (
          <button
            type='button'
            onClick={() => runQueryExplorerQuery()}
            disabled={
              variablesHaveErrors ||
              !query.trim() ||
              result.status === 'loading'
            }
            className='rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50'
            aria-label='Run query'
          >
            Run
          </button>
        )}
      </div>
      {view === 'editor' ? (
        <QueryEditorPanel
          value={query}
          onChange={setQuery}
          hideHeader
          className='min-h-0 flex-1'
        />
      ) : (
        <HistoryPanel
          onLoadEntry={() => setView('editor')}
          className='min-h-0 flex-1 overflow-auto'
        />
      )}
    </div>
  )
}
