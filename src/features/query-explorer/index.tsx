import { ensureSchemaLoaded, useStore } from '@/store'
import { useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
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
