import { useState } from 'react'
import { Braces, Code, History, Play } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { QueryEditorPanel } from './editor-panel'
import { HistoryPanel } from './history-panel'
import { runQueryExplorerQuery } from '../run-query'
import { useStore } from '@/store'
import { formatGraphqlDocument } from '../graphql/format'

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

  const handleFormat = async () => {
    try {
      const formatted = await formatGraphqlDocument(query)
      if (formatted !== query) {
        setQuery(formatted)
      }
    } catch {
      // Ignore formatting failures until the query is syntactically valid.
    }
  }

  return (
    <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
      <div className='flex h-12 shrink-0 items-center justify-between border-b border-border px-3 py-2'>
        <div className='flex items-center gap-4'>
          <h2 className='min-w-16 text-sm font-medium'>
            {view === 'editor' ? 'Editor' : 'History'}
          </h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                onClick={() =>
                  setView(view === 'editor' ? 'history' : 'editor')
                }
                className='rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                aria-label={view === 'editor' ? 'Show history' : 'Show editor'}
              >
                {view === 'editor' ? (
                  <History className='size-4' aria-hidden />
                ) : (
                  <Code className='size-4' aria-hidden />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              {view === 'editor' ? 'History' : 'Editor'}
            </TooltipContent>
          </Tooltip>
        </div>
        {view === 'editor' && (
          <div className='flex items-center gap-2'>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type='button'
                  onClick={() => void handleFormat()}
                  className='rounded bg-slate-200/80 p-1.5 text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                  aria-label='Format query'
                >
                  <Braces className='size-4' aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>Format</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type='button'
                  onClick={() => runQueryExplorerQuery()}
                  disabled={
                    variablesHaveErrors ||
                    !query.trim() ||
                    result.status === 'loading'
                  }
                  className='rounded bg-[#7404e4] p-1.5 text-white transition-colors hover:bg-[#6800cb] disabled:pointer-events-none disabled:opacity-50'
                  aria-label='Run query'
                >
                  <Play className='size-4 fill-current' aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>Run</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
      {view === 'editor' ? (
        <QueryEditorPanel
          value={query}
          onChange={setQuery}
          onFormat={() => void handleFormat()}
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
