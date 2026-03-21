import { ensureSchemaLoaded, useStore } from '@/store'
import { useEffect } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Button } from '@/components/ui/button'
import { ThemeSwitch } from '@/components/theme-switch'
import { useTheme } from '@/context/theme-provider'
import { QueryExplorerLayout } from './components/query-explorer'
import { EditorHistoryContainer } from './components/editor-history-container'
import { ResultViewerPanel } from './components/result-viewer-panel'
import { VariablesPanel } from './components/variables-panel'
import { useResizeWidth } from './hooks/use-resize-width'

const EDITOR_PANEL_MIN = 280
const EDITOR_PANEL_MAX = 1200
const EDITOR_PANEL_DEFAULT = 780

export const DEFAULT_QUERY = `# Sample query in GQL syntax

query GetArtefacts($repo: String!, $ref: String!, $path: String!) {
  repo(name: $repo) {
    ref(name: $ref) {
      file(path: $path) {
        artefacts {
          symbolFqn
          canonicalKind
          semantics {
            summary
          }
        }
      }
    }
  }
}
`

export function QueryExplorer() {
  useEffect(() => {
    ensureSchemaLoaded()
  }, [])

  const { resolvedTheme } = useTheme()
  const variables = useStore((s) => s.variables)
  const setVariables = useStore((s) => s.setVariables)
  const result = useStore((s) => s.result)
  const setVariablesHaveErrors = useStore((s) => s.setVariablesHaveErrors)
  const schemaError = useStore((s) => s.schemaError)
  const schemaLoading = useStore((s) => s.schemaLoading)
  const loadSchema = useStore((s) => s.loadSchema)
  const [editorPanelWidth, onResizeStart] = useResizeWidth({
    defaultWidth: EDITOR_PANEL_DEFAULT,
    minWidth: EDITOR_PANEL_MIN,
    maxWidth: EDITOR_PANEL_MAX,
  })

  return (
    <>
      <Header className='pe-8'>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>
      <Main fixed>
        <div className='mb-4 flex min-h-0 flex-1 flex-col'>
          <div className='shrink-0'>
            <h1 className='text-2xl font-bold tracking-tight'>
              Query Explorer
            </h1>
            <p className='mt-1 text-sm text-muted-foreground'>
              Query and explore your code intelligence data.
            </p>
            {schemaError != null && schemaError !== '' && (
              <div
                className='mt-4 flex w-full items-center gap-2 rounded-md border border-dashed border-red-900/30 bg-red-950/[0.04] px-3 py-2 text-xs text-red-900 dark:border-red-400/35 dark:bg-red-950/25 dark:text-red-200'
                role='alert'
              >
                <TriangleAlert
                  className='size-4 shrink-0 text-red-900 dark:text-red-200'
                  aria-hidden
                />
                <span className='min-w-0 flex-1'>
                  Could not fetch dependencies from the API. Autocomplete is
                  unavailable until it succeeds.
                </span>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='h-7 shrink-0 border-red-900/35 px-2 text-xs text-red-900 hover:bg-red-950/10 dark:border-red-400/40 dark:text-red-200 dark:hover:bg-red-950/40'
                  onClick={() => loadSchema()}
                  disabled={schemaLoading}
                >
                  Try again
                </Button>
              </div>
            )}
          </div>
          <QueryExplorerLayout
            className='mt-4'
            editorPanelWidth={editorPanelWidth}
            onResizeStart={onResizeStart}
            leftPanel={<EditorHistoryContainer />}
            rightPanel={
              <ResultViewerPanel result={result} theme={resolvedTheme} />
            }
            bottomPanel={
              <VariablesPanel
                value={variables}
                onChange={setVariables}
                onValidationChange={setVariablesHaveErrors}
              />
            }
          />
        </div>
      </Main>
    </>
  )
}
